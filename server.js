const { Command } = require('commander');

const program = new Command();

program
    .requiredOption('-h, --host <type>')
    .requiredOption('-p, --port <type>')
    .requiredOption('-c, --cache <type>');

program.parse(process.argv);
const options = program.opts();

const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Express works');
});

app.listen(options.port, options.host, () => {
  console.log(`http://${options.host}:${options.port}`);
});
