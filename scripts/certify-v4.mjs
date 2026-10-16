import {
  assertV4BalanceCertification,
  formatV4BalanceCertification,
  runV4BalanceCertification,
} from "../packages/simulation/dist/certification-v4.js";

const report = runV4BalanceCertification();
assertV4BalanceCertification(report);
console.log(formatV4BalanceCertification(report));
