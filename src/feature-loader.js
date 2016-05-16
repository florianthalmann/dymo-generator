/**
 * @constructor
 */
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
	
	
	
	//////////// RDF //////////////
	
	function loadFeatureFromRdf(rdfUri, labelCondition, generator, callback) {
		httpGet(rdfUri, function(data) {
			parseN3(data, function (store) {
				loadSegmentationFeatureFromRdf(store, function(results) {
					if (results.length > 0) {
						addSegmentationFromRdf(rdfUri, labelCondition, generator, results);
						if (callback) {
							callback();
						}
					} else {
						loadSignalFeatureFromRdf(store, function(results) {
							var name = results.name;
							if (!name) {
								var split = rdfUri.split('_');
								name = split[split.length-1].split('.')[0];
							}
							generator.addFeature(name, results.values);
							if (callback) {
								callback();
							}
						});
					}
				});
			});
		});
	}
	
	function parseN3(data, callback) {
		var store = N3.Store();
		N3.Parser().parse(data, function(error, triple, prefixes) {
			if (triple) {
				store.addTriple(triple);
			} else {
				callback(store);
			}
		});
	}
	
	function loadSegmentationFeatureFromRdf(store, callback) {
		//for now looks at anything containing event times
		var times = [];
		var events = store.find(null, eventOntology+'time', null);
		for (var i = 0, l = events.length; i < l; i++) {
			var time = findObjectInStore(store, events[i].object, timelineOntology+'at');
			if (!time) {
				time = findObjectInStore(store, events[i].object, timelineOntology+'beginsAt');
			}
			var duration = findObjectInStore(store, events[i].object, timelineOntology+'duration');
			var timeObject = {
				time: {value: parseXsdNumber(time)},
				label: {value: parseXsdString(findObjectInStore(store, events[i].subject, rdfsUri+'label'))}
			};
			if (duration) {
				timeObject.duration = {value: parseXsdNumber(duration)};
			}
			times.push(timeObject);
		}
		callback(times);
	}
	
	function loadSignalFeatureFromRdf(store, callback) {
		var name = parseXsdString(findObjectInStore(store, null, dublincoreOntology+'title'));
		var signal = parseXsdString(findObjectInStore(store, null, featureOntology+'value'));
		signal = signal.split(" ").map(function(v) { return parseFloat(v); });
		var dimensions = parseXsdString(findObjectInStore(store, null, featureOntology+'dimensions'));
		dimensions = dimensions.split(' ').map(function(d){ return Number.parseInt(d); });
		var transform = findObjectInStore(store, null, vampOntology+'computed_by');
		var stepSize = parseXsdNumber(findObjectInStore(store, transform, vampOntology+'step_size'));
		var sampleRate = parseXsdNumber(findObjectInStore(store, transform, vampOntology+'sample_rate'));
		
		var values = [];
		var i = 0;
		while (i < signal.length) {
			var currentValue = [];
			for (var j = 0; j < dimensions[0]; j++) {
				currentValue[j] = signal[i+j];
			}
			//insert time/value pairs
			values.push({
				time: {value: i*stepSize/sampleRate},
				value: currentValue
			});
			i += dimensions[0];
		}
		callback({name:name, values:values});
	}
	
	function findObjectInStore(store, subject, predicate) {
		var result = store.find(subject, predicate, null);
		if (result.length > 0) {
			return result[0].object;
		}
	}
	
	function parseXsdString(string) {
		if (string) {
			return N3.Util.getLiteralValue(string);
		}
	}
	
	function parseXsdNumber(string) {
		var value = N3.Util.getLiteralValue(string);
		if (value.charAt(0) == 'P') {
			//xsd duration!
			value = value.substring(2, value.length-1);
		}
		return Number(value);
	}
	
	function addSegmentationFromRdf(rdfUri, labelCondition, generator, times) {
		//save so that file does not have to be read twice
		features[rdfUri] = times.sort(function(a,b){return a.time.value - b.time.value});
		var subset = features[rdfUri];
		if (labelCondition && features[rdfUri][0].label) {
			subset = subset.filter(function(x) { return x.label.value == labelCondition; });
		}
		generator.addSegmentation(subset);
	}
	
	
	
	//////////// JSON //////////////
	
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
		var outputId = results["annotation_metadata"]["annotator"]["output_id"];
		if (outputId == "beats" || outputId == "onsets") {
			results = results.data;
			if (labelCondition && results[0].label) {
				results = results.filter(function(x) { return x.label.value == labelCondition; });
			}
			generator.addSegmentation(results);
			if (callback) {
				callback();
			}
		} else {
			generator.addFeature(outputId, results.data);
			if (callback) {
				callback();
			}
		}
	}
	
	function loadFeatureFromJsonLd(json, labelCondition, generator, callback) {
		var type = json["@type"];
		if (type == "afv:BarandBeatTracker" || type == "afv:Onsets") {
			var values = json["afo:values"];
			if (labelCondition && values[0]["afo:value"]) {
				values = values.filter(function(x) { return x["afo:value"] == labelCondition; });
			}
			values = convertJsonLdLabelEventsToJson(values);
			generator.addSegmentation(values);
			if (callback) {
				callback();
			}
		} else {
			var values = convertJsonLdValueEventsToJson(json["afo:values"]);
			generator.addFeature(type, values);
			if (callback) {
				callback();
			}
		}
	}
	
	function convertJsonLdLabelEventsToJson(events) {
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
	
	function convertJsonLdValueEventsToJson(events) {
		var times = [];
		for (var i = 0; i < events.length; i++) {
			//insert value/label pairs
			times.push({
				time: {value: events[i]["tl:at"]},
				value: [events[i]["afo:value"]]
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
	
}