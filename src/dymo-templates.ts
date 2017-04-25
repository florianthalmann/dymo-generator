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