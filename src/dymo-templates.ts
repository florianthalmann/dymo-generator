import { IterativeSmithWatermanResult } from 'siafun';
import { uris } from 'dymo-core';
import { DymoStructureInducer } from './dymo-structure';
import { DymoGenerator } from './dymo-generator';
import { FeatureLoader } from './feature-loader';

export module DymoTemplates {

	export function createSingleSourceDymoFromFeatures(generator, source, featureUris, conditions): Promise<string> {
		var dymoUri = generator.addDymo(undefined, source);
		return loadMultipleFeatures(generator, dymoUri, featureUris, conditions)
			.then(r => generator.getManager().reloadFromStore())
			.then(r => dymoUri);
	}

	export function createMultiSourceDymo(generator, parentDymo, dymoType, sources, featureUris): Promise<string> {
		var conjunctionDymo = generator.addDymo(parentDymo, null, dymoType);
		var loadSources = sources.map((s,i) => new Promise(resolve => {
			var dymoUri = generator.addDymo(conjunctionDymo, s);
			return loadMultipleFeatures(generator, dymoUri, featureUris[i], null);
		}));
		return Promise.all(loadSources)
			.then(r => conjunctionDymo);
	}

	export function createSimilarityDymoFromFeatures(generator, source, featureUris, conditions, similarityThreshold) {
		var dymoUri = generator.addDymo(undefined, source);
		loadMultipleFeatures(generator, dymoUri, featureUris, conditions)
			.then(r => {
				DymoStructureInducer.addSimilaritiesTo(generator.getCurrentTopDymo(), generator.getStore(), similarityThreshold);
				generator.addRendering();
				generator.addNavigator(uris.SIMILARITY_NAVIGATOR, {"d":uris.LEVEL_FEATURE}, "return d == 0");
			});
	}

	export function createStructuredDymoFromFeatures(generator, options): Promise<IterativeSmithWatermanResult> {
		DymoStructureInducer.flattenStructure(generator.getCurrentTopDymo(), generator.getManager().getStore());
		return generator.getManager().reloadFromStore()
			.then(r => {
				let result = DymoStructureInducer.testSmithWaterman(generator.getCurrentTopDymo(), generator.getManager().getStore(), options);
				//DymoStructureInducer.addStructureToDymo2(generator.getCurrentTopDymo(), generator.getManager().getStore(), options);
				generator.addRendering();
				return generator.getManager().reloadFromStore()
				 .then(r => result);
			});
	}

	export function testSmithWatermanComparison(generator, options, uri1, uri2): Promise<void> {
		DymoStructureInducer.compareSmithWaterman(uri1, uri2, generator.getManager().getStore(), options);
		//DymoStructureInducer.addStructureToDymo2(generator.getCurrentTopDymo(), generator.getManager().getStore(), options);
		generator.addRendering();
		return generator.getManager().reloadFromStore();
	}

	export function createSimilaritySuccessorDymoFromFeatures(generator, source, featureUris, conditions, similarityThreshold, onLoad) {
		var dymoUri = generator.addDymo(undefined, source);
		this.loadMultipleFeatures(generator, dymoUri, featureUris, conditions, function() {
			DymoStructureInducer.addSimilaritiesTo(generator.getCurrentTopDymo(), generator.getStore(), similarityThreshold);
			DymoStructureInducer.addSuccessionGraphTo(generator.getCurrentTopDymo(), generator.getStore(), similarityThreshold);
			generator.addRendering();
			generator.addNavigator(uris.GRAPH_NAVIGATOR, {"d":uris.LEVEL_FEATURE}, "return d == 0");
			//generator.updateGraphs();
			onLoad();
		});
	}

	//expects featurePaths to contain a bar and beat tracker file, followed by any other features
	export function createAnnotatedBarAndBeatDymo(generator, featureUris, onLoad) {
		var uris = [featureUris[0], featureUris[0]];
		var conditions = ['1',''];
		for (var i = 1; i < featureUris.length; i++) {
			uris[i+1] = featureUris[i];
			conditions[i+1] = '';
		}
		this.loadMultipleFeatures(generator, null, uris, conditions, onLoad);
	}

	/*export function createPitchHelixDmo() {
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

	/*export function createGratefulDeadDymo(generator, $scope, $http) {
		var dir = 'features/gd_test/Candyman/_studio/';
		var uris = [];
		uris[0] = dir+'gd1981-05-02d1t05_vamp_segmentino_segmentino_segmentation.n3';
		//uris[1] = dir+'gd1981-05-02d1t05_vamp_qm-vamp-plugins_qm-barbeattracker_beats.n3';
		//uris[2] = dir+'gd1981-05-02d1t05_vamp_qm-vamp-plugins_qm-barbeattracker_beats.n3';
		uris[1] = dir+'gd1981-05-02d1t05_vamp_vamp-libxtract_crest_crest.n3';
		uris[2] = dir+'gd1981-05-02d1t05_vamp_vamp-libxtract_loudness_loudness.n3';
		uris[3] = dir+'gd1981-05-02d1t05_vamp_vamp-libxtract_spectral_centroid_spectral_centroid.n3';
		uris[4] = dir+'gd1981-05-02d1t05_vamp_vamp-libxtract_spectral_standard_deviation_spectral_standard_deviation.n3';
		uris[5] = dir+'gd1981-05-02d1t05_vamp_qm-vamp-plugins_qm-chromagram_chromagram.n3';
		uris[6] = dir+'gd1981-05-02d1t05_vamp_qm-vamp-plugins_qm-mfcc_coefficients.n3';
		//var conditions = ['', ''];
		var conditions = ['', '1', '', '', '', '', '', ''];
		this.loadMultipleFeatures(generator, uris, conditions, 0, function() {
			Similarity.addSimilaritiesTo(generator.dymo);
			generator.similarityGraph = generator.dymo.toJsonSimilarityGraph();
			console.log(generator.similarityGraph)
			$scope.$apply();
		});
	}

	export function createGratefulDeadDymos(generator, $scope, $http) {
		var basedir = 'app/features/gd_test/';
		$http.get('getallfiles/', {params:{directory:basedir}}).success(function(songs) {
			//keep only folders
			songs = songs.filter(function(s) { return s.indexOf('.') < 0; });
			var versionUris = [];
			getNextVersions(0);
			function getNextVersions(i) {
				if (i < songs.length) {
					console.log(songs[i])
					$http.get('getallfiles/', {params:{directory:basedir+songs[i]+'/'}}).success(function(versions) {
						//keep only folders
						versions = versions.filter(function(s) { return s.indexOf('.DS_Store') < 0; });
						for (var j = 0; j < versions.length; j++) {
							versionUris.push(basedir+songs[i]+'/'+versions[j]+'/');
						}
						getNextVersions(i+1);
					});
				} else {
					console.log(versionUris)
					this.loadAndSaveMultipleDeadDymos(generator, versionUris, 0, $http);
				}
			}
		});
	}

	export function loadAndSaveMultipleDeadDymos(generator, versions, i, $http) {
		if (i < versions.length) {
			$http.get('getallfiles/', {params:{directory:versions[i]}}).success(function(features) {
				var versiondir = versions[i].substring(versions[i].indexOf('/'));
				var urisAndConditions = getUris(versiondir, features, ['segmentation.n3','crest.n3','loudness.n3','spectral_centroid.n3','standard_deviation.n3','chromagram.n3','mfcc_coefficients.n3'], ['', '1', '', '', '', '', '', '', '']);
				this.loadMultipleFeatures(generator, urisAndConditions[0], urisAndConditions[1], 0, function() {
					Similarity.addSimilaritiesTo(generator.dymo);
					generator.similarityGraph = generator.dymo.toJsonSimilarityGraph();
					var filename = versiondir.substring(0,versiondir.length-1);
					filename = filename.substring(filename.lastIndexOf('/')+1)+'.dymo.json';
					new DymoWriter($http).writeDymoToJson(generator.dymo.toJsonHierarchy(), 'features/gd_equal_similarity2/', filename);
					generator.resetDymo();
					this.loadAndSaveMultipleDeadDymos(generator, versions, i+1, $http);
				});
			});
		}
	}*/

	/*function getUris(dir, files, names, conditions) {
		var uris = [];
		var conds = [];
		for (var i = 0, l = names.length; i < l; i++) {
			var currentFile = files.filter(function(s) { return s.indexOf(names[i]) > 0; })[0];
			if (currentFile) {
				uris.push(dir+currentFile);
				conds.push(conditions[i]);
			}
		}
		return [uris, conds];
	}*/

	function loadMultipleFeatures(generator: DymoGenerator, dymoUri: string, featureUris: string[], conditions: string[]): Promise<any> {
		//Benchmarker.startTask("loadFeatures")
		var loader = new FeatureLoader(generator, dymoUri);
		var loadFeatures = featureUris.map((f,i) => new Promise(resolve =>
			loader.loadFeature(f, conditions?conditions[i]:null, resolve)
		));
		return Promise.all(loadFeatures);
	}

	export function createSebastianDymo(generator, scheduler, $http) {
		var dirPath = 'audio/Chopin_Op028-04_003_20100611-SMD/';
		var onsetFeature = generator.getFeature("onset");
		var pitchFeature = generator.getFeature("pitch");
		var topDymo = generator.addDymo();
		generator.setDymoFeature(topDymo, onsetFeature, 0);
		generator.setDymoFeature(topDymo, pitchFeature, 0);
		$http.get('getsourcefilesindir/', {params:{directory:dirPath}}).success(function(data) {
			var allFilenames = data;
			allFilenames = allFilenames.filter(function(f) { return f.split("_").length - 1 > 4; });
			for (var i = 0; i < allFilenames.length; i++) {
				//scheduler.addSourceFile(dirPath+allFilenames[i]);
				var nameSegments = allFilenames[i].split("_");
				var onsetSegment = nameSegments[nameSegments.length-1];
				var currentOnset = Number.parseInt(onsetSegment.substring(1, onsetSegment.indexOf('.')),10)/1000;
				var currentPitch = Number.parseInt(nameSegments[nameSegments.length-3].substring(1),10);
				var currentDymo = generator.addDymo(topDymo, dirPath+allFilenames[i]);
				generator.setDymoFeature(currentDymo, onsetFeature, currentOnset);
				generator.setDymoFeature(currentDymo, pitchFeature, currentPitch);
			}
			//GlobalVars.DYMO_STORE.updatePartOrder(topDymo, onsetFeature.name);
			//just to test similarity graph representation
			/*new DymoLoader(scheduler).loadGraphFromJson('bower_components/dymo-core/example/similarity.json', generator.idToDymo, function() {
				//generator.updateGraphAndMap();
			}, $http);*/
		});
	}

	export function createSebastianDymo2(generator, scheduler, $http) {
		var dirPath = 'audio/scale_out/scale_single/';
		var onsetFeature = generator.getFeature("onset");
		var pitchFeature = generator.getFeature("pitch");
		var topDymo = generator.addDymo();
		generator.setDymoFeature(topDymo, onsetFeature, 0);
		generator.setDymoFeature(topDymo, pitchFeature, 0);
		$http.get('getsourcefilesindir/', {params:{directory:dirPath}}).success(function(data) {
			var allFilenames = data;
			allFilenames = allFilenames.filter(function(f) { return f.split("_").length - 1 > 4; });
			for (var i = 0; i < allFilenames.length; i++) {
				//scheduler.addSourceFile(dirPath+allFilenames[i]);
				var nameSegments = allFilenames[i].split("_");
				var currentOnset = Number.parseInt(nameSegments[4].substring(1),10)/1000;
				var currentPitch = Number.parseInt(nameSegments[2].substring(1),10);
				var currentDymo = generator.addDymo(topDymo, dirPath+allFilenames[i]);
				generator.setDymoFeature(currentDymo, onsetFeature, currentOnset);
				generator.setDymoFeature(currentDymo, pitchFeature, currentPitch);
			}
			//GlobalVars.DYMO_STORE.updatePartOrder(topDymo, onsetFeature.name);
		});
	}

	export function createSebastianDymo3(generator, $http) {
		var dirPath = 'audio/Chopin_Op028-11_003_20100611-SMD-cut/';
		var velocityFeature = "velocity";
		var onsetSFeature = "onsetS";
		var durationSFeature = "durationS";
		var topDymo = generator.addDymo();
		generator.setDymoFeature(topDymo, uris.ONSET_FEATURE, 0);
		generator.setDymoFeature(topDymo, uris.PITCH_FEATURE, 0);
		generator.setDymoFeature(topDymo, uris.DURATION_FEATURE, 0);
		generator.setDymoFeature(topDymo, velocityFeature, 0);
		generator.setDymoFeature(topDymo, onsetSFeature, 0);
		generator.setDymoFeature(topDymo, durationSFeature, 0);
		$http.get('getsourcefilesindir/', {params:{directory:dirPath}}).success(function(data) {
			var allFilenames = data;
			allFilenames = allFilenames.filter(function(f) { return f.split("_").length - 1 > 4; });
			for (var i = 0; i < allFilenames.length; i++) {
				//generator.getScheduler().addSourceFile(dirPath+allFilenames[i]);
				var nameSegments = allFilenames[i].split("_");
				var pitch = Number.parseInt(nameSegments[4].substring(1),10);
				var onset = Number.parseInt(nameSegments[6].substring(2),10)/1000;
				var duration = Number.parseInt(nameSegments[7].substring(2),10)/1000;
				var velocity = Number.parseInt(nameSegments[8].substring(2),10);
				var onsetS = Number.parseInt(nameSegments[9].substring(2),10)/1000;
				var durationS = Number.parseInt(nameSegments[10].substring(2),10)/1000;
				var currentDymo = generator.addDymo(topDymo, dirPath+allFilenames[i]);
				generator.setDymoFeature(currentDymo, uris.PITCH_FEATURE, pitch);
				generator.setDymoFeature(currentDymo, uris.ONSET_FEATURE, onset);
				generator.setDymoFeature(currentDymo, uris.DURATION_FEATURE, duration);
				generator.setDymoFeature(currentDymo, velocityFeature, velocity);
				generator.setDymoFeature(currentDymo, onsetSFeature, onsetS);
				generator.setDymoFeature(currentDymo, durationSFeature, durationS);
				currentDymo.getParameter(uris.ONSET).update(onset); //so that it can immediately be played back..
			}
			//GlobalVars.DYMO_STORE.updatePartOrder(topDymo, ONSET_FEATURE);
		});
	}

	export function createAchBachDymo(generator, scheduler, $http) {
		var dirPath = 'audio/achachbach10/';
		var fileName = '01-AchGottundHerr';
		var onsetFeature = generator.getFeature(uris.ONSET_FEATURE);
		var pitchFeature = generator.getFeature(uris.PITCH_FEATURE);
		var durationFeature = generator.getFeature(uris.DURATION_FEATURE);
		var onsetSFeature = generator.getFeature("onsetS");
		var durationSFeature = generator.getFeature("durationS");
		var timeFeature = generator.getFeature("time");
		var topDymo = generator.addDymo();
		generator.setDymoFeature(topDymo, onsetFeature, 0);
		generator.setDymoFeature(topDymo, pitchFeature, 0);
		generator.setDymoFeature(topDymo, durationFeature, 0);
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
				var currentVoice = Number.parseInt(lines[i][3],10);
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
					var pitch = Number.parseInt(values[2],10);
					var onset = Number.parseInt(values[0],10)/1000;
					var onsetS = Number.parseInt(values[1],10)/1000;
					var duration = Number.parseInt(values[4],10)/1000;
					var durationS = Number.parseInt(values[5],10)/1000;
					var currentDymo;
					if (values[3] == 1) {
						currentDymo = generator.addDymo(topDymo, dirPath+fileName+"-violin.wav");
					} else if (values[3] == 2) {
						currentDymo = generator.addDymo(topDymo, dirPath+fileName+"-clarinet.wav");
					} else if (values[3] == 3) {
						currentDymo = generator.addDymo(topDymo, dirPath+fileName+"-saxphone.wav");
					} else if (values[3] == 4) {
						currentDymo = generator.addDymo(topDymo, dirPath+fileName+"-bassoon.wav");
					}
					generator.setDymoFeature(currentDymo, pitchFeature, pitch);
					generator.setDymoFeature(currentDymo, timeFeature, onset);
					generator.setDymoFeature(currentDymo, onsetFeature, onset);
					generator.setDymoFeature(currentDymo, durationFeature, duration);
					generator.setDymoFeature(currentDymo, onsetSFeature, onsetS);
					generator.setDymoFeature(currentDymo, durationSFeature, durationS);
					currentDymo.getParameter(uris.ONSET).update(onset); //so that it can immediately be played back..*/
				}
			}
			//GlobalVars.DYMO_STORE.updatePartOrder(topDymo, onsetFeature.name);
		});

		$http.get('getsourcefilesindir/', {params:{directory:dirPath}}).success(function(data) {
			var allFilenames = data;
			allFilenames = allFilenames.filter(function(f) { return f.indexOf("wav") >= 0; });
			for (var i = 0; i < allFilenames.length; i++) {
				//scheduler.addSourceFile(dirPath+allFilenames[i]);
			}
		});
	}

	/*export function createAreasDemo(generator, areas) {
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

	export function createRandomAreasDemo(generator) {
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
	}*/

	function createRandomTriangle() {
		return [{0:Math.random(),1:Math.random()},{0:Math.random(),1:Math.random()},{0:Math.random(),1:Math.random()}];
	}

}