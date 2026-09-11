import {
  assertBalanceCertification,
  formatBalanceCertification,
  runBalanceCertification,
} from "../packages/simulation/dist/certification.js";

const report = runBalanceCertification();
assertBalanceCertification(report);
console.log(formatBalanceCertification(report));
