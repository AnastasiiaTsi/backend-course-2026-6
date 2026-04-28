const { Command } = require('commander');

const program = new Command();

program
    .requiredOption('-h, --host <type>')
    .requiredOption('-p, --port <type>')
    .requiredOption('-c, --cache <type>');

program.parse(process.argv);
const options = program.opts();

const http = require('http');

const server = http.createServer((req,res) => {
    res.end('Server works');
});

server.listen(options.port, options.host, () => {
    console.log(`http://${options.host}:${options.port}`);
});