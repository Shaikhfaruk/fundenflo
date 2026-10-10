type SubSegment = { key: string; label: string };

export type Segment = { key: string; label: string; description: string | null; icon: string | null; subSegments: SubSegment[] };

type CategoryPurpose = { key: string; label: string; requiresNote: boolean };

type CategoryAvailability = { available: boolean; reason: string | null };

export type LoanCategory = {
  key: string;
  label: string;
  icon: string | null;
  segments: string[];
  minAmountPaise: number;
  maxAmountPaise: number;
  stepPaise: number;
  defaultAmountPaise: number;
  tenureOptionsMonths: number[];
  illustrativeRateBps: number | null;
  purposes: CategoryPurpose[];
  availability?: CategoryAvailability;
};

export type GeoState = { gstCode: string; name: string; kind: string };

export type City = { id: string; name: string; state: { gstCode: string; name: string } };

export type PincodePlace = { pincode: string; district: string | null; state: { gstCode: string; name: string } | null; city: { id: string; name: string } | null };
