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

let inventory = [];

//для JSON, form-data 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// GET 
app.get('/inventory', (req, res) => {
  res.json(inventory);
});

app.listen(options.port, options.host, () => {
  console.log(`http://${options.host}:${options.port}`);
});