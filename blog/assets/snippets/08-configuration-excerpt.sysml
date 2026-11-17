    private import OperationalContext::*;
    private import NavigationRequirements::*;

    part massOperation : MassOperationalContext {
        doc /* A DoA 4 MASS operating under RCC supervision among other ships. */

        part :>> ship {
            :>> degreeOfAutonomy = DegreeOfAutonomy::doa4;
            :>> serviceSpeed = 6 [m/s];
            :>> positionAccuracy = 5 [m];
            :>> cameraCoverage = 360 ['°'];
            :>> obstacleDetectionRange = 12000 [m];
            :>> minimumUnderKeelClearance = 2 [m];
            :>> minimumPassingDistance = 1852 [m];
            :>> maxCrossTrackError = 30 [m];
            :>> dpPositionHoldTolerance = 2 [m];
            :>> vdrRecordingDuration = 720 [h];

            part :>> navigationSystem {
                part :>> decisionMaking {
                    part :>> collisionAvoidance {
                        part :>> globalPathPlanner {
                            :>> algorithm = GlobalPlanningAlgorithm::aStar;
                        }
