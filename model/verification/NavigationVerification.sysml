package NavigationVerification {
    doc /*
     * Verification cases covering every requirement in massNavigationSpecification, plus an
     * encounter analysis that checks a collision avoidance scenario against the passing distance.
     */

    private import ScalarValues::*;
    private import ISQ::*;
    private import SI::*;
    private import VerificationCases::*;
    private import ShipArchitecture::*;
    private import NavigationRequirements::*;
    private import NavigationCalculations::*;
    private import ShipConfiguration::*;

    verification def SensorPerformanceTest {
        doc /* Harbour and sea trials of navigational and SA sensors and sensor fusion, by day, night and in poor visibility. */
        subject ship : AutonomousShip;
        objective {
            verify massNavigationSpecification.positionAccuracy;
            verify massNavigationSpecification.allRoundVision;
            verify massNavigationSpecification.obstacleDetectionRange;
            verify massNavigationSpecification.underKeelClearance;
            verify massNavigationSpecification.soundSignalDetection;
            verify massNavigationSpecification.sensorFusion;
        }
        return :>> verdict = PassIf(
            ship.positionAccuracy <= massNavigationSpecification.positionAccuracy.positionAccuracyMax and
            ship.cameraCoverage >= massNavigationSpecification.allRoundVision.coverageMin and
            ship.obstacleDetectionRange >= massNavigationSpecification.obstacleDetectionRange.detectionRangeMin and
            ship.minimumUnderKeelClearance >= massNavigationSpecification.underKeelClearance.underKeelClearanceMin);
    }

    verification def CollisionAvoidanceSimulation {
        doc /* Simulation of COLREGs encounter scenarios (head-on, crossing, overtaking, multi-ship) followed by sea trials. */
        subject ship : AutonomousShip;
        objective {
            verify massNavigationSpecification.colregsCompliance;
            verify massNavigationSpecification.safePassingDistance;
            verify massNavigationSpecification.hybridPathPlanning;
        }
        return :>> verdict = PassIf(
            ship.minimumPassingDistance >= massNavigationSpecification.safePassingDistance.passingDistanceMin);
    }

    verification def ManoeuvringTrial {
        doc /* Sea trials of path following, DP station keeping, berthing and unberthing under wind and current. */
        subject ship : AutonomousShip;
        objective {
            verify massNavigationSpecification.pathFollowing;
            verify massNavigationSpecification.dynamicPositioning;
            verify massNavigationSpecification.berthing;
        }
        return :>> verdict = PassIf(
            ship.maxCrossTrackError <= massNavigationSpecification.pathFollowing.crossTrackErrorMax and
            ship.dpPositionHoldTolerance <= massNavigationSpecification.dynamicPositioning.positionHoldToleranceMax);
    }

    verification def RemoteOperationTest {
        doc /* End-to-end test with the RCC: mode changes, link loss injection and an autonomous voyage. */
        subject ship : AutonomousShip;
        objective {
            verify massNavigationSpecification.autonomousVoyage;
            verify massNavigationSpecification.operationMode;
            verify massNavigationSpecification.failsafeFallback;
            verify massNavigationSpecification.remoteCommunication;
        }
        return :>> verdict = PassIf(
            ship.degreeOfAutonomy == massNavigationSpecification.autonomousVoyage.requiredAutonomy);
    }

    verification def VoyageDataRecorderInspection {
        doc /* Inspection and test of the VDR and internal database recording. */
        subject ship : AutonomousShip;
        objective {
            verify massNavigationSpecification.voyageDataRecording;
        }
        return :>> verdict = PassIf(
            ship.vdrRecordingDuration >= massNavigationSpecification.voyageDataRecording.recordingDurationMin);
    }

    verification def NavigationSystemAcceptance {
        doc /*
         * Acceptance of the complete MASS navigation specification, carried out by the sensor,
         * collision avoidance, manoeuvring, remote operation and VDR verifications below.
         */
        subject ship : AutonomousShip;
        objective {
            verify massNavigationSpecification;
        }
    }

    analysis def EncounterAnalysis {
        doc /* Predicts the CPA of a single encounter and checks it against the ship's minimum passing distance. */
        subject ship : AutonomousShip;
        in targetRange :> ISQ::length;
        in targetAspectAngle : Real;
        objective {
            doc /* Show whether the encounter keeps the predicted CPA above the minimum passing distance. */
        }
        calc predictedCpa : ClosestPointOfApproach {
            in range = targetRange;
            in aspectAngle = targetAspectAngle;
        }
        return isSafe : Boolean = predictedCpa.cpa >= ship.minimumPassingDistance;
    }

    // Verification of the reference configuration
    verification sensorPerformanceTest : SensorPerformanceTest {
        subject :>> ship = massOperation.ship;
    }
    verification collisionAvoidanceSimulation : CollisionAvoidanceSimulation {
        subject :>> ship = massOperation.ship;
    }
    verification manoeuvringTrial : ManoeuvringTrial {
        subject :>> ship = massOperation.ship;
    }
    verification remoteOperationTest : RemoteOperationTest {
        subject :>> ship = massOperation.ship;
    }
    verification voyageDataRecorderInspection : VoyageDataRecorderInspection {
        subject :>> ship = massOperation.ship;
    }
    verification navigationSystemAcceptance : NavigationSystemAcceptance {
        subject :>> ship = massOperation.ship;
    }
    analysis crossingEncounter : EncounterAnalysis {
        subject :>> ship = massOperation.ship;
        in targetRange = 5000 [m];
        in targetAspectAngle = 0.5;
    }
}
