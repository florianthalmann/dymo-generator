function DymoTemplates() { }

//expects featurePaths to contain a bar and beat tracker file, followed by any other features
DymoTemplates.createAnnotatedBarAndBeatDymo = function(generator, featureUris, $scope, $http) {
	var loader = new FeatureLoader($scope, $http);
	loader.loadFeature(featureUris[0], '1', generator); //load bars
	loader.loadFeature(featureUris[0], '', generator); //load beats
	for (var i = 1; i < featureUris.length; i++) {
		loader.loadFeature(featureUris[i], '', generator); //load other features
	}
}

/*DymoTemplates.createPitchHelixDmo = function() {
	chromaFeature = getFeature("chroma");
	heightFeature = getFeature("height");
	var previousDmo = null;
	for (var i = 0; i < 48; i++) {
		var currentDmo = createNewDmo();
		if (previousDmo) {
			addPartDmo(previousDmo, currentDmo);
		} else {
			addTopDmo(currentDmo);
		}
		var cos = Math.cos((i % 12) / 6 * Math.PI);
		var sin = Math.sin((i % 12) / 6 * Math.PI);
		setDymoFeature(currentDmo, chromaFeature, cos+1);
		setDymoFeature(currentDmo, heightFeature, sin+1+(i/4.5));
		previousDmo = currentDmo;
	}
}*/

DymoTemplates.createSebastianDymo = function() {
	var dirPath = 'audio/Chopin_Op028-04_003_20100611-SMD/';
	var onsetFeature = getFeature("onset");
	var pitchFeature = getFeature("pitch");
	var topDymo = addDymo();
	setDymoFeature(topDymo, onsetFeature, 0);
	setDymoFeature(topDymo, pitchFeature, 0);
	$http.get('getsourcefilesindir/', {params:{directory:dirPath}}).success(function(data) {
		var allFilenames = data;
		allFilenames = allFilenames.filter(function(f) { return f.split("_").length - 1 > 4; });
		for (var i = 0; i < allFilenames.length; i++) {
			$scope.scheduler.addSourceFile(dirPath+allFilenames[i]);
			var nameSegments = allFilenames[i].split("_");
			var onsetSegment = nameSegments[nameSegments.length-1];
			var currentOnset = Number.parseInt(onsetSegment.substring(1, onsetSegment.indexOf('.')))/1000;
			var currentPitch = Number.parseInt(nameSegments[nameSegments.length-3].substring(1));
			var currentDymo = addDymo(topDymo, dirPath+allFilenames[i]);
			setDymoFeature(currentDymo, onsetFeature, currentOnset);
			setDymoFeature(currentDymo, pitchFeature, currentPitch);
		}
		topDymo.updatePartOrder(onsetFeature.name);
		//just to test similarity graph representation
		new DymoLoader(scheduler).loadGraphFromJson('bower_components/dymo-core/example/similarity.json', idToDymo, function() {
			updateGraphAndMap();
		}, $http);
	});
}

DymoTemplates.createSebastianDymo2 = function() {
	var dirPath = 'audio/scale_out/scale_single/';
	var onsetFeature = getFeature("onset");
	var pitchFeature = getFeature("pitch");
	var topDymo = addDymo();
	setDymoFeature(topDymo, onsetFeature, 0);
	setDymoFeature(topDymo, pitchFeature, 0);
	$http.get('getsourcefilesindir/', {params:{directory:dirPath}}).success(function(data) {
		var allFilenames = data;
		allFilenames = allFilenames.filter(function(f) { return f.split("_").length - 1 > 4; });
		for (var i = 0; i < allFilenames.length; i++) {
			$scope.scheduler.addSourceFile(dirPath+allFilenames[i]);
			var nameSegments = allFilenames[i].split("_");
			var currentOnset = Number.parseInt(nameSegments[4].substring(1))/1000;
			var currentPitch = Number.parseInt(nameSegments[2].substring(1));
			var currentDymo = addDymo(topDymo, dirPath+allFilenames[i]);
			setDymoFeature(currentDymo, onsetFeature, currentOnset);
			setDymoFeature(currentDymo, pitchFeature, currentPitch);
		}
		topDymo.updatePartOrder(onsetFeature.name);
	});
}

DymoTemplates.createSebastianDymo3 = function(generator, $http) {
	var dirPath = 'audio/Chopin_Op028-11_003_20100611-SMD-cut/';
	var velocityFeature = "velocity";
	var onsetSFeature = "onsetS";
	var durationSFeature = "durationS";
	var topDymo = generator.addDymo();
	generator.setDymoFeature(topDymo, ONSET_FEATURE, 0);
	generator.setDymoFeature(topDymo, PITCH_FEATURE, 0);
	generator.setDymoFeature(topDymo, DURATION_FEATURE, 0);
	generator.setDymoFeature(topDymo, velocityFeature, 0);
	generator.setDymoFeature(topDymo, onsetSFeature, 0);
	generator.setDymoFeature(topDymo, durationSFeature, 0);
	$http.get('getsourcefilesindir/', {params:{directory:dirPath}}).success(function(data) {
		var allFilenames = data;
		allFilenames = allFilenames.filter(function(f) { return f.split("_").length - 1 > 4; });
		for (var i = 0; i < allFilenames.length; i++) {
			generator.getScheduler().addSourceFile(dirPath+allFilenames[i]);
			var nameSegments = allFilenames[i].split("_");
			var pitch = Number.parseInt(nameSegments[4].substring(1));
			var onset = Number.parseInt(nameSegments[6].substring(2))/1000;
			var duration = Number.parseInt(nameSegments[7].substring(2))/1000;
			var velocity = Number.parseInt(nameSegments[8].substring(2));
			var onsetS = Number.parseInt(nameSegments[9].substring(2))/1000;
			var durationS = Number.parseInt(nameSegments[10].substring(2))/1000;
			var currentDymo = generator.addDymo(topDymo, dirPath+allFilenames[i]);
			generator.setDymoFeature(currentDymo, PITCH_FEATURE, pitch);
			generator.setDymoFeature(currentDymo, ONSET_FEATURE, onset);
			generator.setDymoFeature(currentDymo, DURATION_FEATURE, duration);
			generator.setDymoFeature(currentDymo, velocityFeature, velocity);
			generator.setDymoFeature(currentDymo, onsetSFeature, onsetS);
			generator.setDymoFeature(currentDymo, durationSFeature, durationS);
			currentDymo.getParameter(ONSET).update(onset); //so that it can immediately be played back..
		}
		topDymo.updatePartOrder(ONSET_FEATURE);
	});
}

DymoTemplates.createAchBachDymo = function() {
	var dirPath = 'audio/achachbach10/';
	var fileName = '01-AchGottundHerr';
	var onsetFeature = getFeature(ONSET_FEATURE);
	var pitchFeature = getFeature(PITCH_FEATURE);
	var durationFeature = getFeature(DURATION_FEATURE);
	var onsetSFeature = getFeature("onsetS");
	var durationSFeature = getFeature("durationS");
	var timeFeature = getFeature("time");
	var topDymo = addDymo();
	setDymoFeature(topDymo, onsetFeature, 0);
	setDymoFeature(topDymo, pitchFeature, 0);
	setDymoFeature(topDymo, durationFeature, 0);
	//setDymoFeature(topDymo, velocityFeature, 0);
	//setDymoFeature(topDymo, onsetSFeature, 0);
	//setDymoFeature(topDymo, durationSFeature, 0);
	var previousOnsets = [];
	$http.get(dirPath+fileName+".txt").success(function(json) {
		var lines = json.split("\n");
		//split and sort lines
		for (var i = 0; i < lines.length; i++) {
			lines[i] = lines[i].split("\t");
		}
		lines.sort(function(a,b) { return a[0] - b[0]; });
		//add durations
		var previousOnsets = [];
		for (var i = 0; i < lines.length; i++) {
			var currentOnset = lines[i][0];
			var currentOnsetS = lines[i][1];
			var currentVoice = Number.parseInt(lines[i][3]);
			if (previousOnsets[currentVoice]) {
				var previousOnsetIndex = previousOnsets[currentVoice][0];
				var previousDuration = currentOnset - previousOnsets[currentVoice][1];
				var previousDurationS = currentOnsetS - previousOnsets[currentVoice][2];
				lines[previousOnsetIndex][4] = previousDuration;
				lines[previousOnsetIndex][5] = previousDurationS;
			}
			previousOnsets[currentVoice] = [i, currentOnset, currentOnsetS];
		}
		for (var i = lines.length-4; i < lines.length; i++) {
			lines[i][4] = 2700;
			lines[i][5] = 2700;
		}
		//create dymos
		for (var i = 0; i < lines.length; i++) {
			if (lines[i].length == 6) {
				var values = lines[i];
				var pitch = Number.parseInt(values[2]);
				var onset = Number.parseInt(values[0])/1000;
				var onsetS = Number.parseInt(values[1])/1000;
				var duration = Number.parseInt(values[4])/1000;
				var durationS = Number.parseInt(values[5])/1000;
				var currentDymo;
				if (values[3] == 1) {
					currentDymo = addDymo(topDymo, dirPath+fileName+"-violin.wav");
				} else if (values[3] == 2) {
					currentDymo = addDymo(topDymo, dirPath+fileName+"-clarinet.wav");
				} else if (values[3] == 3) {
					currentDymo = addDymo(topDymo, dirPath+fileName+"-saxphone.wav");
				} else if (values[3] == 4) {
					currentDymo = addDymo(topDymo, dirPath+fileName+"-bassoon.wav");
				}
				setDymoFeature(currentDymo, pitchFeature, pitch);
				setDymoFeature(currentDymo, timeFeature, onset);
				setDymoFeature(currentDymo, onsetFeature, onset);
				setDymoFeature(currentDymo, durationFeature, duration);
				setDymoFeature(currentDymo, onsetSFeature, onsetS);
				setDymoFeature(currentDymo, durationSFeature, durationS);
				currentDymo.getParameter(ONSET).update(onset); //so that it can immediately be played back..*/
			}
		}
		topDymo.updatePartOrder(onsetFeature.name);
	});
	
	$http.get('getsourcefilesindir/', {params:{directory:dirPath}}).success(function(data) {
		var allFilenames = data;
		allFilenames = allFilenames.filter(function(f) { return f.indexOf("wav") >= 0; });
		for (var i = 0; i < allFilenames.length; i++) {
			$scope.scheduler.addSourceFile(dirPath+allFilenames[i]);
		}
	});
}

DymoTemplates.createAreasDemo = function(generator, areas) {
	generator.addDymo();
	if (areas.length > 0) {
		var brownianX = new BrownianControls();
		var brownianY = new BrownianControls();
		brownianX.frequency.update(500);
		brownianY.frequency.update(500);
		brownianX.maxStepSize.update(0.1);
		brownianY.maxStepSize.update(0.1);
		for (var i = 0; i < areas.length; i++) {
			var currentArea = areas[i];
			var currentAreaFunction = PolygonTools.getPolygonFunctionString(currentArea);
			var currentDymo = generator.dymo.getParts()[i];
			generator.dymo.addMapping(new Mapping([brownianX.brownianControl, brownianY.brownianControl], false, currentAreaFunction, [currentDymo], PLAY));
			currentAreaFunction = PolygonTools.getInterpolatedPolygonFunctionString(currentArea);
			generator.dymo.addMapping(new Mapping([brownianX.brownianControl, brownianY.brownianControl], false, currentAreaFunction, [currentDymo], AMPLITUDE));
			currentDymo.getParameter(LOOP).update(1);
		}
	} else {
		this.createRandomAreasDemo(generator);
	}
}

DymoTemplates.createRandomAreasDemo = function(generator) {
	var brownianX = new BrownianControls();
	var brownianY = new BrownianControls();
	brownianX.maxStepSize.update(0.03);
	brownianY.maxStepSize.update(0.03);
	for (var i = 0; i < generator.dymo.getParts().length; i++) {
		var currentArea = createRandomTriangle();
		var currentAreaFunction = PolygonTools.getPolygonFunctionString(currentArea);
		var currentDymo = generator.dymo.getParts()[i];
		generator.dymo.addMapping(new Mapping([brownianX.brownianControl, brownianY.brownianControl], false, currentAreaFunction, [currentDymo], PLAY));
		currentAreaFunction = PolygonTools.getInterpolatedPolygonFunctionString(currentArea);
		generator.dymo.addMapping(new Mapping([brownianX.brownianControl, brownianY.brownianControl], false, currentAreaFunction, [currentDymo], AMPLITUDE));
		currentDymo.getParameter(LOOP).update(1);
	}
}

function createRandomTriangle() {
	return [{0:Math.random(),1:Math.random()},{0:Math.random(),1:Math.random()},{0:Math.random(),1:Math.random()}];
}
