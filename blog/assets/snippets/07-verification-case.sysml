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
