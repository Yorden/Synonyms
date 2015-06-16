//creates a new angular app called synonymApp
var app = angular.module("synonymApp", ["firebase"]);

app.run(function ($templateCache){

	//templateCache is not being used at this time
	$templateCache.put('synonym-mini-game.html', '');
});
//creates a new app controller caller AppCtrl
app.controller("AppCtrl", ['$scope', '$http', '$interval', '$firebase', '$firebaseObject', '$firebaseArray', function ($scope, $http, $interval, $firebase, $firebaseObject, $firebaseArray) {


	$scope.userid = Math.round(Math.random() * 586);
	//get Json data about animals?
	$scope.animals = [];
	$http.get("animals.json").success(function(response) { $scope.animals = response.data; });

	//connecting to firebase
	var amOnline = new Firebase('https://synonymtest1.firebaseio.com/.info/connected');
	var presenceRef = new Firebase('https://synonymtest1.firebaseio.com/presence/');
	var userRef = presenceRef.push();

	var roomRef = new Firebase('https://synonymtest1.firebaseio.com/roomInfo')

	$scope.players = $firebaseArray(presenceRef);

	$scope.players.$loaded().then(function() {
        userRef.set({points: 0, userid:$scope.userid});

        //Sticking this here to make sure it waits for the page to load first.
        var intro = introJs();
		intro.start();
    });

	var inactionCounter = 0;

	$scope.points = 0;//player points value
	$scope.seconds = 0;//this is the initial value for the timer.  This is reset later.
	$scope.showSubmit = true;
	$scope.showCompare = false;

	var intervalPromise = null;
	var active = false;

	$scope.wordlist = [];//this is an array of word objects that will be populated when fetchData() is called.
	var listIndex = 0;
	var synTracker = [];
	//http recieves the wordlist json file and sets the respose to $scope.wordlist
	$http.get("wordlist.json").success(function(response) {$scope.wordlist = response.data;});

	//?This function is used to setup the initial game logic for the game.
	//gets the data and makes the
	$scope.fetchData = function() {

		$scope.showSubmit = false;

		$scope.words = [];
		//for every word in the wordlist on the left of the page
		for (var i = 0; i <= $scope.wordlist[listIndex].synonyms.length - 1; i++) {

			var blanks = "";
			//note: syn is a reference to the syn string located in the Json object
			//this for loop is referencing each of the synonyms under the "word" variable in the Json file
			//based on how many letters are in that word, a dash is added to the "blanks" variable
			for (var j = 0; j <= $scope.wordlist[listIndex].synonyms[i].syn.length - 1; j++) {
				blanks += "-"
			};
			//synTracker is used later on to track what synonyms have been used
			synTracker[i] = i;
			//creates an object and places it inside $scope.words at each index,
			//word:is the synonym of listIndex index root word at index i
			//dummy: these are the blanks saved earlier based on the length of the synonym
			$scope.words[i] = {word: $scope.wordlist[listIndex].synonyms[i].syn, dummy:blanks, toSwap:0, strike:false, points:""};
		}

		$scope.showCompare = true;
		$scope.myWord = $scope.wordlist[listIndex].word;//gets the word from Json
		$scope.definition = $scope.wordlist[listIndex].definition;//gets the definition
		$scope.status = "";
		timerStart();
	};

	$scope.compare = function() {

		inactionCounter = 0;
		$scope.input = $scope.input.toLowerCase();
		//for loop runs for the length of the list of words
		//THIS DECREMENTS NOT INCREMENTS
		for (var i = $scope.words.length - 1; i >= 0; i--) {
			//if the input is equal to the word at index i
			if($scope.words[i].word == $scope.input) {
				//if the strike value is false
				//this is if you get a word correct
				if(!$scope.words[i].strike){

					$scope.status = "Good job!";
					$scope.input = "";
					$scope.words[i].dummy = $scope.words[i].word; //sets the words dummy value to the word itself, this is used to set the word to static text once it has been used
					$scope.words[i].strike = true; //sets the strike value to true.  This is so the word cannot be entered again
					//note: the following toSwap value is incremented in the inactionTrigger() function and is a member of $scope.words
					$scope.points += $scope.words[i].word.length - $scope.words[i].toSwap;// this awards the player points based on the length of the word and the toSwap value.
					//??why does this need to recalculate the points value??
					$scope.words[i].points = "+ " + ($scope.words[i].word.length - $scope.words[i].toSwap);
					//??not sure what this does yet??
					userRef.update({points: $scope.points});
					//remove a completed synonym from the list of synonyms
					trackerRemove(i);
					return;
				}
				else {
					//if the player enters a synonym that has alread been entered, the status is updated and the input is reset
					$scope.status = "You entered that word already. Try again.";
					$scope.input = "";
					return;
				}
			}
		};
		//im guessing this is some sort of fail safe if the word does not work for whatever reason
		$scope.status = "That word didn't work. Try again.";
		$scope.input = "";
	};

		//Helper functions

	//Custom string character replace function
	var replaceAt = function(str, index, chr) {
		//this essentially gets the amount of the synonym the game is giving to the player.
		//in other words, it gets how much the game is hinting at the player
		//note: the substr(param1, param2) function gets the string from param1 to param2. param2 is optional
		return str.substr(0,index) + chr + str.substr(index+1);
	}

	//Remove a completed synonym from the tracker list
	var trackerRemove = function(index) {
		//looks for the the synonymTracker index that is equal to the passed in index
		//if there is a match, remove that index
		//THIS DECREMENTS NOT INCREMENTS
		for (var i = synTracker.length - 1; i >= 0; i--) {
			if(synTracker[i] == index) {
				//removes the index at i
				synTracker.splice(i, 1);
			}
		};
	}

	//if the player spends too much time inactive, not guessing values, this triggers
	var inactionTrigger = function() {

		inactionCounter = 0;

		var wordIndex = Math.round(Math.random() * (synTracker.length - 1));
		var item = $scope.words[synTracker[wordIndex]];
		item.dummy = replaceAt(item.dummy, item.toSwap, item.word.charAt(item.toSwap));
		item.toSwap++;
		console.log(item.toSwap);

		if(item.toSwap == item.word.length - 1) {

			trackerRemove(synTracker[wordIndex]);
		}
	}
	//used to check of the timer has reached 0
	var outOfTime = function() {

		$scope.status = "Out of time. Revealing answers.";
		listIndex++;
		inactionCounter = 0;

		for (var i = $scope.words.length - 1; i >= 0; i--) {

			$scope.words[i].dummy = $scope.words[i].word;
			$scope.words[i].toSwap = $scope.words[i].word.length - 1;
		}

		if(listIndex == $scope.wordlist.length) {

			$scope.myWord = "Game Over"
			$scope.definition = "No more words remain. Thanks for playing!"
			return;
		}

		$scope.showSubmit = true;
	}

	var timerStart = function() {

		$scope.seconds = 45;
		active = true;

		if (intervalPromise == null) {intervalPromise = $interval(timerTick, 1000);}
	}

	var timerStop = function() {

		$interval.cancel(intervalPromise);
		intervalPromise = null;
		active = false;
	}

	var timerTick = function() {

		if(active) {
			$scope.seconds--;
			inactionCounter++;

			if($scope.seconds === 0) {
	        	timerStop();
	        	outOfTime();
			}
			else if(inactionCounter == 1) {
				inactionTrigger();
			}
		}
	}
	intervalPromise = $interval(timerTick, 1000);






	//Connetivity and Multiplayer stuff
	amOnline.on('value', function(snapshot) {
   		if (snapshot.val()) {
     		userRef.onDisconnect().remove();
     		userRef.set(true);
  		}
	});
}]);

app.directive('appdir', function ($templateCache) {

	return {
		restrict: 'E',
		//template: $templateCache.get('synonym-mini-game.html')
		templateUrl: 'synonym-template.html'
	};
});

app.filter('playerFilter', ['$http', function($http) {
	return function(input, userid, scope) {

		if (scope.animals[input]) {
			var out = scope.animals[input].name;

			if(input == userid) {
				out += " (You)";
			}

			return out;
		}
	}
}]);
