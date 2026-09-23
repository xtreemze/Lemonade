// biome-ignore lint/correctness/noUnresolvedImports: certify builds simulation/dist before loading this module.
import {
  assertBalanceCertification,
  formatBalanceCertification,
  runBalanceCertification,
} from "../packages/simulation/dist/certification.js";

const report = runBalanceCertification();
assertBalanceCertification(report);
console.log(formatBalanceCertification(report));
