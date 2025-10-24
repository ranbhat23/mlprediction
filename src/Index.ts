
import { runStrategy } from './multilinear.js';

async function main() {
  try {

await runStrategy();
  }
  catch(err) {
    console.log(err);
  }
}
main();