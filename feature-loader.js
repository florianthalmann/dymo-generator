function FeatureLoader() {
	
	var mobileRdfUri = "rdf/mobile.n3";
	var multitrackRdfUri = "http://purl.org/ontology/studio/multitrack";
	var rdfsUri = "http://www.w3.org/2000/01/rdf-schema#";
	
	var eventOntology = "http://purl.org/NET/c4dm/event.owl#";
	var timelineOntology = "http://purl.org/NET/c4dm/timeline.owl#";
	var featureOntology = "http://purl.org/ontology/af/";
	var vampOntology = "http://purl.org/ontology/vamp/";
	var dublincoreOntology = "http://purl.org/dc/elements/1.1/";
	
	var features = {}
	
	this.loadFeature = function(uri, labelCondition, generator, callback) {
		var fileExtension = uri.split('.');
		fileExtension = fileExtension[fileExtension.length-1];
		if (fileExtension == 'n3') {
			loadFeatureFromRdf(uri, labelCondition, generator, callback);
		} else if (fileExtension == 'json') {
			loadFeatureFromJson(uri, labelCondition, generator, callback);
		}
	}
		
	function loadFeatureFromRdf(rdfUri, labelCondition, generator, callback) {
		/*if (features[rdfUri]) {
			setFeatureFromRdf(rdfUri, labelCondition, generator);
		} else {*/
			
			httpGet(rdfUri, function(data) {
				rdfstore.create(function(err, store) {
					store.load('text/turtle', data, function(err, results) {
						if (err) {
							console.log(err);
							callback();
						} else {
							loadSegmentationFeatureFromRdf(store, function(results) {
								if (results.length > 0) {
									addSegmentationFromRdf(rdfUri, labelCondition, generator, results);
									callback();
								} else {
									loadSegmentinoFeatureFromRdf(store, function(results) {
										if (results.length > 0) {
											addSegmentationFromRdf(rdfUri, labelCondition, generator, results);
											callback();
										} else {
											loadSignalFeatureFromRdf(store, function(results) {
												generator.addFeature(results[0].name.value, convertRdfSignalToJson(results[0]));
												callback();
											});
										}
									});
								}
							});
						}
						
					});
				});
			});
			//}
	}
	
	function addSegmentationFromRdf(rdfUri, labelCondition, generator, results) {
		var times = convertRdfEventsToJson(results);
		//save so that file does not have to be read twice
		features[rdfUri] = times.sort(function(a,b){return a.time.value - b.time.value});
		var subset = features[rdfUri];
		if (labelCondition && features[rdfUri][0].label) {
			subset = subset.filter(function(x) { return x.label.value == labelCondition; });
		}
		generator.addSegmentation(subset);
	}
	
	function loadSegmentationFeatureFromRdf(store, callback) {
		//for now looks at anything containing event times
		//?eventType <"+rdfsUri+"#subClassOf>* <"+eventOntology+"#Event> . \
		store.execute("SELECT ?xsdTime ?label \
			WHERE { ?event a ?eventType . \
			?event <"+eventOntology+"time> ?time . \
			?time <"+timelineOntology+"at> ?xsdTime . \
			OPTIONAL { ?event <"+rdfsUri+"label> ?label . } }", function(err, results) {
				callback(results);
			}
		);
	}
	
	function loadSegmentinoFeatureFromRdf(store, callback) {
		//for now looks at anything containing event times
		//?eventType <"+rdfsUri+"#subClassOf>* <"+eventOntology+"#Event> . \
		store.execute("SELECT ?xsdTime ?label \
			WHERE { ?event a ?eventType . \
			?event <"+eventOntology+"time> ?time . \
			?time <"+timelineOntology+"beginsAt> ?xsdTime . \
			OPTIONAL { ?event <"+rdfsUri+"label> ?label . } }", function(err, results) {
				callback(results);
			}
		);
	}
	
	function loadSignalFeatureFromRdf(store, callback) {
		store.execute("SELECT ?values ?name ?stepSize ?sampleRate \
			WHERE { ?signal a ?signalType . \
			?signal <"+featureOntology+"value> ?values . \
			?signalType <"+dublincoreOntology+"title> ?name . \
			?signal <"+vampOntology+"computed_by> ?transform . \
			?transform <"+vampOntology+"step_size> ?stepSize . \
			?transform <"+vampOntology+"sample_rate> ?sampleRate . }", function(err, results) {
				callback(results);
			}
		);
	}
	
	function convertRdfEventsToJson(results) {
		var times = [];
		for (var i = 0; i < results.length; i++) {
			//insert value/label pairs
			times.push({
				time: {value: toSecondsNumber(results[i].xsdTime.value)},
				label: {value: getValue(results[i].label)}
			});
		}
		return times;
	}
	
	function convertRdfSignalToJson(results) {
		var signal = results.values.value.split(" ").map(function(v) { return parseFloat(v); });
		var stepSize = parseInt(results.stepSize.value);
		var sampleRate = parseInt(results.sampleRate.value);
		var values = [];
		for (var i = 0; i < signal.length; i++) {
			//insert value/label pairs
			values.push({
				time: {value: i*stepSize/sampleRate},
				value: [signal[i]]
			});
		}
		return values;
	}
	
	function getValue(result) {
		if (result) {
			return result.value;
		}
	}
	
	function loadFeatureFromJson(jsonUri, labelCondition, generator, callback) {
		httpGet(jsonUri, function(json) {
			json = JSON.parse(json);
			var results = json[Object.keys(json)[1]][0];
			var outputId = results.annotation_metadata.annotator.output_id;
			if (outputId == "beats" || outputId == "onsets") {
				results = results.data;
				if (labelCondition && results[0].label) {
					results = results.filter(function(x) { return x.label.value == labelCondition; });
				}
				generator.addSegmentation(results);
				callback();
			} else {
				generator.addFeature(outputId, results.data);
				callback();
			}
		});
	}
	
	function loadGraph(dmo, parameterUri, jsonUri) {
		httpGet(jsonUri, function(json) {
			dmo.setGraph(json);
		});
	}
	
	function httpGet(uri, onLoad) {
		var xhr = new XMLHttpRequest();
		xhr.addEventListener("load", function() {
			console.log("loaded " + uri);
			onLoad(this.responseText);
		});
		xhr.addEventListener("error", function() {
			console.log("loading " + uri + " failed");
			onLoad(this.responseText);
		});
		xhr.open("GET", uri);
		xhr.send();
	}
	
	function toSecondsNumber(xsdDurationString) {
		return Number(xsdDurationString.substring(2, xsdDurationString.length-1));
	}
	
}