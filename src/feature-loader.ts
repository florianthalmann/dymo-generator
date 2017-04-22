import { Parser, Store, Util } from 'n3';

export class FeatureLoader {

	private generator;
	private dymoUri;

	private mobileRdfUri = "rdf/mobile.n3";
	private multitrackRdfUri = "http://purl.org/ontology/studio/multitrack";
	private rdfsUri = "http://www.w3.org/2000/01/rdf-schema#";

	private eventOntology = "http://purl.org/NET/c4dm/event.owl#";
	private timelineOntology = "http://purl.org/NET/c4dm/timeline.owl#";
	private featureOntology = "http://purl.org/ontology/af/";
	private vampOntology = "http://purl.org/ontology/vamp/";
	private dublincoreOntology = "http://purl.org/dc/elements/1.1/";

	private features = {}

	constructor(generator, dymoUri) {
		this.generator = generator;
		this.dymoUri = dymoUri;
	}

	loadFeature(uriOrJson, labelCondition, callback) {
		if (uriOrJson.constructor == Object) {
			//it's a json!
			this.loadFeatureFromJson(uriOrJson, labelCondition, callback);
		} else {
			//just a uri..
			var fileExtension = uriOrJson.split('.');
			fileExtension = fileExtension[fileExtension.length-1];
			if (fileExtension == 'n3') {
				this.loadFeatureFromRdf(uriOrJson, labelCondition, callback);
			} else if (fileExtension == 'json') {
				this.loadFeatureFromJsonUri(uriOrJson, labelCondition, callback);
			}
		}
	}



	//////////// RDF //////////////

	private loadFeatureFromRdf(rdfUri, labelCondition, callback) {
		this.httpGet(rdfUri, data => {
			this.parseN3(data, function (store) {
				this.loadSegmentationFeatureFromRdf(store, results => {
					if (results.length > 0) {
						this.addSegmentationFromRdf(rdfUri, labelCondition, results);
						if (callback) {
							callback();
						}
					} else {
						this.loadSignalFeatureFromRdf(store, results => {
							var name = results.name;
							if (!name) {
								var split = rdfUri.split('_');
								name = split[split.length-1].split('.')[0];
							}
							this.generator.addFeature(name, results.values, this.dymoUri);
							if (callback) {
								callback();
							}
						});
					}
				});
			});
		});
	}

	private parseN3(data, callback) {
		var store = Store(null, null);
		Parser(null).parse(data, (error, triple, prefixes) => {
			if (triple) {
				store.addTriple(triple);
			} else {
				callback(store);
			}
		});
	}

	private loadSegmentationFeatureFromRdf(store, callback) {
		//for now looks at anything containing event times
		var times = [];
		var events = store.find(null, this.eventOntology+'time', null);
		for (var i = 0, l = events.length; i < l; i++) {
			var time = this.findObjectInStore(store, events[i].object, this.timelineOntology+'at');
			if (!time) {
				time = this.findObjectInStore(store, events[i].object, this.timelineOntology+'beginsAt');
			}
			var duration = this.findObjectInStore(store, events[i].object, this.timelineOntology+'duration');
			var timeObject = {
				time: this.parseXsdNumber(time),
				label: this.parseXsdString(this.findObjectInStore(store, events[i].subject, this.rdfsUri+'label'))
			};
			if (duration) {
				timeObject["duration"] = this.parseXsdNumber(duration);
			}
			times.push(timeObject);
		}
		callback(times);
	}

	private loadSignalFeatureFromRdf(store, callback) {
		var name = this.parseXsdString(this.findObjectInStore(store, null, this.dublincoreOntology+'title'));
		var signal = this.parseXsdString(this.findObjectInStore(store, null, this.featureOntology+'value'));
		signal = signal.split(" ").map(v => parseFloat(v));
		var dimensions = this.parseXsdString(this.findObjectInStore(store, null, this.featureOntology+'dimensions'));
		dimensions = dimensions.split(' ').map(d => Number.parseInt(d, 10));
		var transform = this.findObjectInStore(store, null, this.vampOntology+'computed_by');
		var stepSize = this.parseXsdNumber(this.findObjectInStore(store, transform, this.vampOntology+'step_size'));
		var sampleRate = this.parseXsdNumber(this.findObjectInStore(store, transform, this.vampOntology+'sample_rate'));

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

	private findObjectInStore(store, subject, predicate) {
		var result = store.find(subject, predicate, null);
		if (result.length > 0) {
			return result[0].object;
		}
	}

	private parseXsdString(string) {
		if (string) {
			return Util.getLiteralValue(string);
		}
	}

	private parseXsdNumber(string) {
		var value = Util.getLiteralValue(string);
		if (value.charAt(0) == 'P') {
			//xsd duration!
			value = value.substring(2, value.length-1);
		}
		return Number(value);
	}

	private addSegmentationFromRdf(rdfUri, labelCondition, times) {
		//save so that file does not have to be read twice
		this.features[rdfUri] = times.sort((a,b) => a.time.value - b.time.value);
		var subset = this.features[rdfUri];
		if (labelCondition && this.features[rdfUri][0].label) {
			subset = subset.filter(x => x.label.value == labelCondition);
		}
		this.generator.addSegmentation(subset, this.dymoUri);
	}



	//////////// JSON //////////////

	private loadFeatureFromJsonUri(jsonUri, labelCondition, callback) {
		this.httpGet(jsonUri, json => {
			this.loadFeatureFromJson(JSON.parse(json), labelCondition, callback);
		});
	}

	private loadFeatureFromJson(json, labelCondition, callback) {
		if (Object.keys(json)[0] == "file_metadata") {
			this.loadFeatureFromJams(json, labelCondition, callback);
		} else {
			this.loadFeatureFromJsonLd(json, labelCondition, callback);
		}
	}

	private loadFeatureFromJams(json, labelCondition, callback) {
		var results = json[Object.keys(json)[1]][0];
		var outputId = results["annotation_metadata"]["annotator"]["output_id"];
		if (outputId == "beats" || outputId == "onsets" || outputId == "segmentation") {
			results = results.data;
			if (labelCondition && results[0].value) {
				results = results.filter(x => x.value == labelCondition);
			}
			this.generator.addSegmentation(results, this.dymoUri);
			if (callback) {
				callback();
			}
		} else {
			this.generator.addFeature(outputId, results.data, this.dymoUri);
			if (callback) {
				callback();
			}
		}
	}

	private loadFeatureFromJsonLd(json, labelCondition, callback) {
		var type = json["@type"];
		if (type == "afv:BarandBeatTracker" || type == "afv:Onsets") {
			let values = json["afo:values"];
			if (labelCondition && values[0]["afo:value"]) {
				values = values.filter(x => x["afo:value"] == labelCondition);
			}
			values = this.convertJsonLdLabelEventsToJson(values);
			this.generator.addSegmentation(values, this.dymoUri);
			if (callback) {
				callback();
			}
		} else {
			let values = this.convertJsonLdValueEventsToJson(json["afo:values"]);
			this.generator.addFeature(type, values, this.dymoUri);
			if (callback) {
				callback();
			}
		}
	}

	private convertJsonLdLabelEventsToJson(events) {
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

	private convertJsonLdValueEventsToJson(events) {
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

	private httpGet(uri, onLoad) {
    fetch(uri, { mode: 'cors' })
      .then(response => response.text())
      .then(text => onLoad(text));
  }

}
