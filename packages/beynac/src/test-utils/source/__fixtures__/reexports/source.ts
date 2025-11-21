import { BaseClass } from "../../../../utils";

// Value exports for re-export testing
export class OriginalClass extends BaseClass {}

export const originalValue = "original";

export function originalFunc() {}

// Type exports for re-export testing
export interface OriginalInterface {
	id: string;
}

export type OriginalType = {
	value: number;
};
