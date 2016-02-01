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
	
	this.loadFeature = function(uriOrJson, labelCondition, generator, callback) {
		if (uriOrJson.constructor == Object) {
			//it's a json!
			loadFeatureFromJson(uriOrJson, labelCondition, generator, callback);
		} else {
			//just a uri..
			var fileExtension = uriOrJson.split('.');
			fileExtension = fileExtension[fileExtension.length-1];
			if (fileExtension == 'n3') {
				loadFeatureFromRdf(uriOrJson, labelCondition, generator, callback);
			} else if (fileExtension == 'json') {
				loadFeatureFromJsonUri(uriOrJson, labelCondition, generator, callback);
			}
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
												var name = getValue(results[0].name);
												if (!name) {
													var split = rdfUri.split('_');
													name = split[split.length-1].split('.')[0];
												}
												var dimensions = results[0].dimensions.value.split(' ').map(function(d){ return Number.parseInt(d); });
												generator.addFeature(name, convertRdfSignalToJson(results[0], dimensions));
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
		store.execute("SELECT ?values ?name ?stepSize ?sampleRate ?dimensions \
			WHERE { ?signal a ?signalType . \
			?signal <"+featureOntology+"value> ?values . \
			?signal <"+featureOntology+"dimensions> ?dimensions . \
			?signal <"+vampOntology+"computed_by> ?transform . \
			?transform <"+vampOntology+"step_size> ?stepSize . \
			?transform <"+vampOntology+"sample_rate> ?sampleRate . \
			OPTIONAL { ?signalType <"+dublincoreOntology+"title> ?name . } }", function(err, results) {
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
	
	function convertRdfSignalToJson(results, dimensions) {
		var signal = results.values.value.split(" ").map(function(v) { return parseFloat(v); });
		var stepSize = parseInt(results.stepSize.value);
		var sampleRate = parseInt(results.sampleRate.value);
		var values = [];
		var i = 0;
		while (i < signal.length) {
			var currentValue = [];
			for (var j = 0; j < dimensions[0]; j++) {
				currentValue[j] = signal[i+j];
			}
			//insert value/label pairs
			values.push({
				time: {value: i*stepSize/sampleRate},
				value: currentValue
			});
			i += dimensions[0];
		}
		return values;
	}
	
	function getValue(result) {
		if (result) {
			return result.value;
		}
	}
	
	function loadFeatureFromJsonUri(jsonUri, labelCondition, generator, callback) {
		httpGet(jsonUri, function(json) {
			loadFeatureFromJson(JSON.parse(json), labelCondition, generator, callback);
		});
	}
	
	function loadFeatureFromJson(json, labelCondition, generator, callback) {
		if (Object.keys(json)[0] == "file_metadata") {
			loadFeatureFromJams(json, labelCondition, generator, callback);
		} else {
			loadFeatureFromJsonLd(json, labelCondition, generator, callback);
		}
	}
	
	function loadFeatureFromJams(json, labelCondition, generator, callback) {
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
	}
	
	function loadFeatureFromJsonLd(json, labelCondition, generator, callback) {
		var type = json["@type"];
		if (type == "afv:BarandBeatTracker" || type == "afv:Onsets") {
			var values = json["afo:values"];
			if (labelCondition && values[0]["afo:value"]) {
				values = values.filter(function(x) { return x["afo:value"] == labelCondition; });
			}
			values = convertJsonLdEventsToJson(values);
			generator.addSegmentation(values);
			callback();
		} else {
			generator.addFeature(type, json["afo:values"]);
			callback();
		}
	}
	
	function convertJsonLdEventsToJson(events) {
		var times = [];
		for (var i = 0; i < events.length; i++) {
			//insert value/label pairs
			times.push({
				time: {value: events[i]["tl:at"]},
				label: {value: events[i]["afo:value"]}
			});
		}
		return times;
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