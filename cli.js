const { Command } = require('commander');

const program = new Command();

program
  .option('-h, --host <type>')
  .option('-p, --port <type>');

program.parse(process.argv);

const options = program.opts();

console.log(options);