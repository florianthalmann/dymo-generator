import * as _ from 'lodash';
import { uris } from 'dymo-core';
import { DymoGenerator } from './dymo-generator';
import { DymoTemplates as dt } from './dymo-templates';

interface ParseInfo {
  index: number, //segmentIndex
  prefix: number, //prefixLength
  divisor: number //divisor
}

export module PerformanceDymos {

  //var dirPath = 'audio/Chopin_Op028-04_003_20100611-SMD/';
  //var dirPath = 'audio/scale_out/scale_single/';
  export function createSimplePerformanceDymo(audioFileNames: string[]): DymoGenerator {
    let scoreFeatures = [uris.ONSET_FEATURE, uris.PITCH_FEATURE];
    let scoreParseInfo = [{index: 4, prefix: 1, divisor: 1000}, {index: 2, prefix: 2, divisor: 1}];
    return createPerformanceDymo(audioFileNames, scoreFeatures, [], scoreParseInfo, []);
  }

  //TODO CREATE REAL REPRESENTATION WITH SCORE AND PERFORMANCE!!!!!
  //var dirPath = 'audio/Chopin_Op028-11_003_20100611-SMD-cut/';
  export function createSebastianDymo3(audioFileNames: string[]): DymoGenerator {
    let scoreFeatures = [uris.CONTEXT_URI+"scoreOnset", uris.CONTEXT_URI+"scoreDuration", uris.CONTEXT_URI+"scorePitch"];
    let perfFeatures = [uris.ONSET_FEATURE, uris.DURATION_FEATURE, uris.CONTEXT_URI+"velocity"];
    let scoreParseInfo = [
      {index: 9, prefix: 2, divisor: 1000},
      {index: 10, prefix: 2, divisor: 1000},
      {index: 4, prefix: 1, divisor: 1}
    ];
    let perfParseInfo = [
      {index: 6, prefix: 2, divisor: 1000},
      {index: 7, prefix: 2, divisor: 1000},
      {index: 8, prefix: 2, divisor: 1}
    ];
    return createPerformanceDymo(audioFileNames, scoreFeatures, perfFeatures, scoreParseInfo, perfParseInfo);
  }

  function createPerformanceDymo(audioFileNames: string[], scoreFeatures: string[],
      perfFeatures: string[], scoreParseInfo: ParseInfo[], perfParseInfo: ParseInfo[]): DymoGenerator {
    let generator = new DymoGenerator();
    let perfDymo = generator.addDymo();
    scoreFeatures.concat(perfFeatures).forEach(f => generator.setDymoFeature(perfDymo, f, 0));
    let maxIndex = _.max(scoreParseInfo.concat(perfParseInfo).map(pi => pi.index));
    audioFileNames
      //only take filenames that contain enough info
      .filter(filename => filename.split("_").length - 1 >= maxIndex)
      .forEach(filename => {
        let scoreValues = scoreParseInfo.map(p => parseValue(filename, p));
        let perfValues = perfParseInfo.map(p => parseValue(filename, p));
        var currentDymo = generator.addDymo(perfDymo, filename);
        scoreFeatures.forEach((f,i) => generator.setDymoFeature(currentDymo, f, scoreValues[i]));
        perfFeatures.forEach((f,i) => generator.setDymoFeature(currentDymo, f, perfValues[i]));
      });
    generator.getManager().getStore().updatePartOrder(perfDymo, uris.ONSET_FEATURE);
    return generator;
  }

  function parseValue(inputString: string, parseInfo: ParseInfo): number {
    let segments = inputString.split("_");
    let valueString = segments[parseInfo.index].substring(parseInfo.prefix);
    return Number.parseInt(valueString, 10) / parseInfo.divisor;
  }

  /*export function createAchBachDymo() {
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
    $http.get(dirPath + fileName + ".txt").success(function(json) {
      var lines = json.split("\n");
      //split and sort lines
      for (var i = 0; i < lines.length; i++) {
        lines[i] = lines[i].split("\t");
      }
      lines.sort(function(a, b) { return a[0] - b[0]; });
      //add durations
      var previousOnsets = [];
      for (var i = 0; i < lines.length; i++) {
        var currentOnset = lines[i][0];
        var currentOnsetS = lines[i][1];
        var currentVoice = Number.parseInt(lines[i][3], 10);
        if (previousOnsets[currentVoice]) {
          var previousOnsetIndex = previousOnsets[currentVoice][0];
          var previousDuration = currentOnset - previousOnsets[currentVoice][1];
          var previousDurationS = currentOnsetS - previousOnsets[currentVoice][2];
          lines[previousOnsetIndex][4] = previousDuration;
          lines[previousOnsetIndex][5] = previousDurationS;
        }
        previousOnsets[currentVoice] = [i, currentOnset, currentOnsetS];
      }
      for (var i = lines.length - 4; i < lines.length; i++) {
        lines[i][4] = 2700;
        lines[i][5] = 2700;
      }
      //create dymos
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].length == 6) {
          var values = lines[i];
          var pitch = Number.parseInt(values[2], 10);
          var onset = Number.parseInt(values[0], 10) / 1000;
          var onsetS = Number.parseInt(values[1], 10) / 1000;
          var duration = Number.parseInt(values[4], 10) / 1000;
          var durationS = Number.parseInt(values[5], 10) / 1000;
          var currentDymo;
          if (values[3] == 1) {
            currentDymo = generator.addDymo(topDymo, dirPath + fileName + "-violin.wav");
          } else if (values[3] == 2) {
            currentDymo = generator.addDymo(topDymo, dirPath + fileName + "-clarinet.wav");
          } else if (values[3] == 3) {
            currentDymo = generator.addDymo(topDymo, dirPath + fileName + "-saxphone.wav");
          } else if (values[3] == 4) {
            currentDymo = generator.addDymo(topDymo, dirPath + fileName + "-bassoon.wav");
          }
          generator.setDymoFeature(currentDymo, pitchFeature, pitch);
          generator.setDymoFeature(currentDymo, timeFeature, onset);
          generator.setDymoFeature(currentDymo, onsetFeature, onset);
          generator.setDymoFeature(currentDymo, durationFeature, duration);
          generator.setDymoFeature(currentDymo, onsetSFeature, onsetS);
          generator.setDymoFeature(currentDymo, durationSFeature, durationS);
          currentDymo.getParameter(uris.ONSET).update(onset); //so that it can immediately be played back..
        }
      }
      //GlobalVars.DYMO_STORE.updatePartOrder(topDymo, onsetFeature.name);
    });

    $http.get('getsourcefilesindir/', { params: { directory: dirPath } }).success(function(data) {
      var allFilenames = data;
      allFilenames = allFilenames.filter(function(f) { return f.indexOf("wav") >= 0; });
      for (var i = 0; i < allFilenames.length; i++) {
        //scheduler.addSourceFile(dirPath+allFilenames[i]);
      }
    });
  }*/

}