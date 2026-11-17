package ShipConfiguration {
    doc /*
     * The reference MASS configuration: the AutonomousShip in its operational context
     * with an RCC, other ships, the port and the environment, with design values bound and
     * requirement satisfaction claimed. Design values are illustrative, not from the paper.
     */

    private import ScalarValues::*;
    private import ISQ::*;
    private import SI::*;
    private import ShipDataItems::*;
    private import ShipArchitecture::*;
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
                        part :>> localPathGenerator {
                            :>> algorithm = LocalPlanningAlgorithm::velocityObstacle;
                        }
                    }
                    part :>> control {
                        part :>> motionController {
                            :>> method = MotionControlMethod::modelPredictiveControl;
                        }
                    }
                }
            }
        }
    }

    // Requirement satisfaction
    satisfy massNavigationSpecification by massOperation.ship;
    satisfy massNavigationSpecification.autonomousVoyage by massOperation.ship;
    satisfy massNavigationSpecification.operationMode by massOperation.ship;
    satisfy massNavigationSpecification.failsafeFallback by massOperation.ship;
    satisfy massNavigationSpecification.positionAccuracy by massOperation.ship;
    satisfy massNavigationSpecification.allRoundVision by massOperation.ship;
    satisfy massNavigationSpecification.obstacleDetectionRange by massOperation.ship;
    satisfy massNavigationSpecification.soundSignalDetection by massOperation.ship;
    satisfy massNavigationSpecification.underKeelClearance by massOperation.ship;
    satisfy massNavigationSpecification.sensorFusion by massOperation.ship;
    satisfy massNavigationSpecification.colregsCompliance by massOperation.ship;
    satisfy massNavigationSpecification.safePassingDistance by massOperation.ship;
    satisfy massNavigationSpecification.hybridPathPlanning by massOperation.ship;
    satisfy massNavigationSpecification.pathFollowing by massOperation.ship;
    satisfy massNavigationSpecification.dynamicPositioning by massOperation.ship;
    satisfy massNavigationSpecification.berthing by massOperation.ship;
    satisfy massNavigationSpecification.voyageDataRecording by massOperation.ship;
    satisfy massNavigationSpecification.remoteCommunication by massOperation.ship;
}
