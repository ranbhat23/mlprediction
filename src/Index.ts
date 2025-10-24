
import { runStrategy } from './multilinear.js';
import { transform } from './csvtojson.js';

async function main() {
  try {

//await runStrategy();
transform();
  }
  catch(err) {
    console.log(err);
  }
}
main();