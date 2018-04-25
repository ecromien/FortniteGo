var app = angular.module("myapp", [
    'mobile-angular-ui',

    // touch/drag feature: this is from 'mobile-angular-ui.gestures.js'
    // it is at a very beginning stage, so please be careful if you like to use
    // in production. This is intended to provide a flexible, integrated and and
    // easy to use alternative to other 3rd party libs like hammer.js, with the
    // final pourpose to integrate gestures into default ui interactions like
    // opening sidebars, turning switches on/off ..
    'mobile-angular-ui.gestures',
    'uiGmapgoogle-maps',
    'firebase',
])

app.config(function (uiGmapGoogleMapApiProvider) {
    uiGmapGoogleMapApiProvider.configure({
        key: 'AIzaSyC0CVr2hW0V95VScenMs_j-iVYlj48yliE',
        v: '3.17',
        libraries: 'weather,geometry,visualization'
    });
});

app.controller("mycontroller", function ($scope, $interval, uiGmapGoogleMapApi, $firebaseObject) {
    var gameClock;
    var baseRef;
    //cant do this on client side js...
    //const functions = require('firebase-functions');
    //const admin = require('firebase-admin');
    //admin.initializeApp(functions.config().firebase);
    angular.extend($scope, {
        init: function () {
            uiGmapGoogleMapApi.then($scope.mapsReady);
            document.addEventListener('deviceready', $scope.deviceReady, false);
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition($scope.positionReady);
            } else {
                x.innerHTML = "Geolocation is not supported by this browser.";
            }

        },
        initializeFirebase: function(){
            baseRef = new Firebase("https://fortnitego-7ed79.firebaseio.com/");
            
            //var ref = new Firebase("https://fortnitego-7ed79.firebaseio.com/"); //  + $scope.sKey + "/"
            //$scope.matches = $firebaseObject(ref);  
        },
        model: {},
        initializeStorage: function () {
            sMd5 = CryptoJS.MD5($scope.model.uname + $scope.model.password + "topSecret");
            localStorage.setItem("sMD5", sMd5);
            $scope.sKey = localStorage.getItem("sMD5");
            $scope.initializeFirebase();
            //$scope.init();
            $scope.init();
        },
        deviceReady: function(){
        },
        mapsReady: function (map) {
            //var nextCircleById = document.getElementById("nextCircleId");
            //maps.event.addListenerOnce(maps, 'idle', function() {
                //maps.event.trigger(maps, 'resize');
            //});
            //console.log('here');
            //******************* 
            // tried some stuff to get grey maps after hiding fixed but didnt work
            //***************** 
            google.maps.event.trigger(map, "resize");

        },
        userMessage: "Edit circle then hit start match.",
        map: { center: { latitude: 45, longitude: -73 }, zoom: 14 }, //initalize map location structure
        circle: { center: { latitude: 45, longitude: -73 }, radius: 1000 }, //initalize circle
        nextCircle: { center: { latitude: 45, longitude: -73 }, radius: 998 }, //initalize circle (2 less as a test to see if fixes line color)
        origCircle: { center: { latitude: 45, longitude: -73 }, radius: 1000 },
        dist: 0,
        markers: [],
        timerCount: 0,
        health: 100,
        testLoc: 0,//new google.maps.LatLng(69,69),
        moveCircleInterval: 5,
        moveCircleTimer: 5,
        matchTime: 25,
        origSize: 1000,
        longMove: 0,
        latMove: 0,
        moveDist: 0,
        moveTime: false,
        existsMessage: "",
        isAdmin: false,
        createNewMatch: function(matchName){
           // $scope.matches[uuid.v4()] = { name: matchName};
           //  $scope.matches.$save();
            baseRef.child('matches/' + matchName).set({name: matchName, admin: $scope.model.uname});
            baseRef.child('matches/' + matchName + '/players/' + $scope.model.uname).set({name: $scope.model.uname, status: 'alive'});
            $scope.isAdmin = true;
            //$scope.matchName = matchName;
        },
        findMatch: function(matchName){
            baseRef.child('matches/' + matchName + '/name').once("value", snapshot => {
                const mat = snapshot.val();
                if (mat){
                    $scope.existsMessage="joining match...";
                    baseRef.child('matches/' + matchName + '/players/' + $scope.model.uname).set({name: $scope.model.uname, status: 'alive'});
                    $scope.existsMessage="Match Joined!";
                    $scope.particpateInMatch(matchName);
                }else{
                    $scope.existsMessage="Match not found";
                }
             })
        },
        particpateInMatch: function(matchName){ //for non admin players
            //firebase listener event
            baseRef.child('matches/' + matchName + '/gameObjects').on("value", snapshot => {
                const gameObj = snapshot.val();
                $scope.userMessage = "Match Underway";
                if (gameObj){
                    $scope.circle.center.latitude = gameObj.circle.lat;
                    $scope.circle.center.longitude =  gameObj.circle.long;
                    $scope.circle.radius = gameObj.circle.radius;
                    $scope.nextCircle.center.latitude = gameObj.nextCircle.lat;
                    $scope.nextCircle.center.longitude =  gameObj.nextCircle.long;
                    $scope.nextCircle.radius = gameObj.nextCircle.radius;
                    console.log($scope.circle.radius); //for debug
                    $scope.getInCircle(); //check if in circle
                }else{
                    $scope.existsMessage="Match Not Yet Started";
                }
             });
           
        },
        startMatch: function(){ //for admin to run
                $scope.userMessage="";
                $scope.setCircleDB();
                $scope.setNextCircleDB();
                gameClock = $interval(function(){
                    console.log($scope.timerCount);
                   $scope.timerCount++;
                   $scope.moveCircleTimer--;
                   $scope.getInCircle();
                   if($scope.timerCount % $scope.moveCircleInterval == 0){
                    $scope.moveCircleTimer = $scope.moveCircleInterval;
                    $scope.setNextCircle();
                    $scope.updateNextCircleDB();
                   }
                   if($scope.moveTime){
                    $scope.moveStorm();
                    $scope.updateCircleDB();
                    }
               },1000)
        },
        moveCircle: function(x,y){
            $scope.circle.center.latitude += 0.001*y;
            $scope.circle.center.longitude += 0.001*x;
            $scope.nextCircle.center.latitude += 0.001*y;
            $scope.nextCircle.center.longitude += 0.001*x;
        },
        resizeCircle: function(x){
            $scope.circle.radius *= x;
            $scope.nextCircle.radius *= x;
        },
        setNextCircle: function(){
            //not the best algorithm for accuracy if concerned about distances near poles 
            //but should be fine for this application
            if($scope.timerCount < $scope.matchTime){
                var r_earth = 6378000;
                var r1  = $scope.nextCircle.radius;
                var r2 = r1 * 0.5;
                var angle = Math.random()*2*Math.PI;
                $scope.moveDist = (0.6*Math.random() + 0.4)*(r1-r2); //60 percent random movement with minimum 40% move
                var xDist = Math.sin(angle)*$scope.moveDist;
                var yDist = Math.cos(angle)*$scope.moveDist;
                //store calulations for use in moving storm circle
                $scope.radiusChange = r1-r2;
                $scope.longMove = (yDist / r_earth) * (180 / Math.PI) / Math.cos($scope.nextCircle.center.latitude * Math.PI/180);
                $scope.latMove = (xDist / r_earth) * (180 / Math.PI);
                $scope.nextCircle.center.longitude += $scope.longMove;
                $scope.nextCircle.center.latitude  += $scope.latMove;
                $scope.nextCircle.radius = r2;
                //begin moving the storm circle
                $scope.moveTime = true;
            }else{
                //end the game
                $interval.cancel(gameClock);
                gameClock = null;
                $scope.moveTime = false;
                $scope.userMessage = "Game Finished";
            }    
            //$scope.nextCircle.center.longitude = $scope.nextCircle.center.longitude + (yDist / r_earth) * (180 / Math.PI) / Math.cos($scope.nextCircle.center.latitude * Math.PI/180);
        },
        moveStorm: function(){
            $scope.circle.center.latitude += $scope.latMove/$scope.moveCircleInterval;
            $scope.circle.center.longitude += $scope.longMove/$scope.moveCircleInterval;
            $scope.circle.radius -= $scope.radiusChange/$scope.moveCircleInterval;
        },
        getInCircle: function(){
            navigator.geolocation.getCurrentPosition($scope.inCircle);
        },
        inCircle: function(position){
            function getDistanceFromLatLonInM(lat1,lon1,lat2,lon2) {
                var R = 6371; // Radius of the earth in km
                var dLat = deg2rad(lat2-lat1);  // deg2rad below
                var dLon = deg2rad(lon2-lon1); 
                var a = 
                  Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2)
                  ; 
                var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
                var d = R * c * 1000; // Distance in Meteres
                return d;
              }
              
              function deg2rad(deg) {
                return deg * (Math.PI/180);
              }
              
              $scope.dist = getDistanceFromLatLonInM($scope.circle.center.latitude,$scope.circle.center.longitude,position.coords.latitude,position.coords.longitude);
              if($scope.dist > $scope.circle.radius){
                  $scope.userMessage = "You're in the storm, run!";
                  $scope.health -= 2;
              }
        },
        reset : function(){
            if(gameClock){
                $interval.cancel(gameClock);
                gameClock = null;
            }
            $scope.map.center.latitude = $scope.origCircle.center.latitude;
            $scope.map.center.longitude = $scope.origCircle.center.longitude;
            $scope.circle.center.latitude = $scope.origCircle.center.latitude;
            $scope.circle.center.longitude = $scope.origCircle.center.longitude;
            $scope.nextCircle.center.latitude = $scope.origCircle.center.latitude;
            $scope.nextCircle.center.longitude = $scope.origCircle.center.longitude;
            $scope.circle.radius = $scope.origSize;
            $scope.nextCircle.radius = $scope.origSize;
            $scope.health = 100;
            $scope.timerCount = 0;
            $scope.radiusChange = 0;
            $scope.moveCircleTimer = $scope.moveCircleInterval;
            $scope.userMessage = "Edit circle then hit start.";
            $scope.moveTime = false;
            $scope.updateCircleDB();
            $scope.updateNextCircleDB();
        },
        positionReady: function(position){
            $scope.map.center.latitude = position.coords.latitude;
            $scope.map.center.longitude = position.coords.longitude;
            $scope.circle.center.latitude = position.coords.latitude;
            $scope.circle.center.longitude = position.coords.longitude;
            $scope.nextCircle.center.latitude = position.coords.latitude;
            $scope.nextCircle.center.longitude = position.coords.longitude;
            $scope.origCircle.center.latitude = position.coords.latitude;
            $scope.origCircle.center.longitude = position.coords.longitude; 
            var posMarker = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                title: 'myPos'
            }
            var idKey = "id";
            posMarker[idKey] = 0; // have to add this for 'preformace'
            $scope.markers[0] = posMarker;
            $scope.$apply();
        },
        setCircleDB: function(){ 
            console.log($scope.model.matchName); 
            baseRef.child('matches/' + $scope.model.matchName + '/gameObjects/circle/').set({lat: $scope.circle.center.latitude, 
                long: $scope.circle.center.longitude, radius: $scope.circle.radius});
        },
        setNextCircleDB: function(){  
            console.log($scope.model.matchName);
            baseRef.child('matches/' + $scope.model.matchName + '/gameObjects/nextCircle/').set({lat: $scope.nextCircle.center.latitude, 
                long: $scope.nextCircle.center.longitude, radius: $scope.nextCircle.radius});
        },
        updateCircleDB: function(){  //update is slightly different than set
            console.log($scope.model.matchName);
            baseRef.child('matches/' + $scope.model.matchName + '/gameObjects/circle/').update({lat: $scope.circle.center.latitude, 
                long: $scope.circle.center.longitude, radius: $scope.circle.radius});
        },
        updateNextCircleDB: function(){  
            console.log($scope.model.matchName);
            baseRef.child('matches/' + $scope.model.matchName + '/gameObjects/nextCircle/').update({lat: $scope.nextCircle.center.latitude, 
                long: $scope.nextCircle.center.longitude, radius: $scope.nextCircle.radius});
        },
    }); //.init();


});
