# wot-replay-lib-js
Javascript driven library for parsing world of tanks replays

## Example

```js
//Prepare xhr object (you could also allow user to drag&drop his local file instead)
var xhr = new XMLHttpRequest();
xhr.open('GET', "replays/20141224_0025_france-AMX_50_120_13_erlenberg.wotreplay", true);

//This is important, replay parser uses arraybuffer
//Loading file in plain text would result in problems with UTF-8 encoding
xhr.responseType = 'arraybuffer';

xhr.onload = function(e) {
  //Replay parser will parse provided arraybuffer
  var replay = new wot.parser().parse(xhr.response));
  //Display basic replay info
  console.log(replay.begin);
};

xhr.send();
```
