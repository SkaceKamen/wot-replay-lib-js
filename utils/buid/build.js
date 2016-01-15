var exec = require('child_process').exec,
	sources = "../../src",
	dist = "../../dist",
	result = "wot",
	files = [
		"wot", "wot.parser",
		"wot.player", "wot.player.event",
		"wot.replay", "wot.replay.packet", "wot.replay.packet.reader", "wot.replay.packet.types"
	];
	
for(var i in files) {
	files[i] = JSON.stringify(sources + "/" + files[i] + ".js");
}

command = "uglifyjs " + files.concat([
	"-o", dist + "/" + result + ".min.js",
	"--source-map", dist + "/" + result + ".min.js.map",
	"--source-map-root", "/",
	"-c", "-m", "-p", "2"
]).join(" ");

exec(command, function(code, stdout, stderr) {
	if (code)
		console.log(code);
	if (stdout)
		console.log(stdout);
	if (stderr)
		console.log(stderr);
});

command = "uglifyjs " + files.concat([
	"-o", dist + "/" + result + ".js",
	"--source-map", dist + "/" + result + ".js.map",
	"--source-map-root", "/",
	"-p", "2", "-b"
]).join(" ");

exec(command, function(code, stdout, stderr) {
	if (code)
		console.log(code);
	if (stdout)
		console.log(stdout);
	if (stderr)
		console.log(stderr);
});