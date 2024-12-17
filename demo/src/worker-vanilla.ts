import { registerMethods } from "@bigmistqke/worker-proxy";
import WorkerMethods from "./worker-methods.ts";

export default registerMethods(WorkerMethods)