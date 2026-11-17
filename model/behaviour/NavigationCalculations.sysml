package NavigationCalculations {
    doc /*
     * Calculations and constraints used by collision avoidance and path following:
     * closest point of approach (CPA), time to CPA, and the safety constraints that
     * the requirements and verification cases check against.
     */

    private import ScalarValues::*;
    private import ISQ::*;
    private import SI::*;
    private import TrigFunctions::*;

    calc def ClosestPointOfApproach {
        doc /*
         * Distance at the closest point of approach for a target at the given range, where
         * aspectAngle is the angle in radians between the line of sight to the target and the
         * relative velocity (0 = collision course).
         */
        in range :> ISQ::length;
        in aspectAngle : Real;
        return cpa :> ISQ::length = range * sin(aspectAngle);
    }

    calc def TimeToClosestPointOfApproach {
        doc /* Time until the closest point of approach, from range, relative speed and aspect angle (radians). */
        in range :> ISQ::length;
        in relativeSpeed : SpeedValue;
        in aspectAngle : Real;
        return tcpa :> ISQ::duration = range * cos(aspectAngle) / relativeSpeed;
    }

    constraint def SafePassingConstraint {
        doc /* The predicted CPA must not be less than the minimum passing distance. */
        in cpa :> ISQ::length;
        in minimumPassingDistance :> ISQ::length;
        cpa >= minimumPassingDistance
    }

    constraint def CrossTrackErrorConstraint {
        doc /* The cross-track error from the planned path must stay within its limit. */
        in crossTrackError :> ISQ::length;
        in maxCrossTrackError :> ISQ::length;
        crossTrackError <= maxCrossTrackError
    }

    constraint def UnderKeelClearanceConstraint {
        doc /* The measured depth below the keel must not be less than the minimum under-keel clearance. */
        in depthBelowKeel :> ISQ::length;
        in minimumUnderKeelClearance :> ISQ::length;
        depthBelowKeel >= minimumUnderKeelClearance
    }
}
