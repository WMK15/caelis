import { CaelisError } from "@caelis/core";

/** Error raised when a guarded project change cannot be planned or applied safely. */
export class ChangePlanError extends CaelisError {
  public constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message, "CHANGE_PLAN_ERROR", details);
  }
}
