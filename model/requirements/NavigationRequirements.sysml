package NavigationRequirements {
    doc /*
     * Requirements for the MASS autonomous navigation system, derived from the
     * capabilities described in Alamoush and Ölçer (2025). Measurable requirements are
     * parameterised; threshold values are bound in massNavigationSpecification.
     */

    private import ScalarValues::*;
    private import ISQ::*;
    private import SI::*;
    private import ShipDataItems::*;
    private import ShipArchitecture::*;

    // ------------------------------------------------------------------
    // Autonomy and decision making
    // ------------------------------------------------------------------

    requirement def <'NAV-001'> AutonomousVoyageRequirement {
        doc /* The ship shall navigate from origin to destination at the required degree of autonomy without human intervention. */
        subject ship : AutonomousShip;
        attribute requiredAutonomy : DegreeOfAutonomy;
        require constraint { ship.degreeOfAutonomy == requiredAutonomy }
    }

    requirement def <'DM-001'> OperationModeRequirement {
        doc /* The virtual captain shall determine the ship status and switch between autonomous, remote-controlled and onboard manual operation. */
        subject ship : AutonomousShip;
    }

    requirement def <'DM-002'> FailsafeFallbackRequirement {
        doc /*
         * On loss of connectivity during an operational challenge, the ship shall in turn request
         * manual control, slow down and proceed to the next waypoint, stop and hold in DP, return to
         * the previous waypoint, and return to a pre-set safe location, until one succeeds.
         */
        subject ship : AutonomousShip;
    }

    // ------------------------------------------------------------------
    // Situational awareness and sensor fusion
    // ------------------------------------------------------------------

    requirement def <'SA-001'> PositionAccuracyRequirement {
        doc /* The ship shall determine its own position with a horizontal accuracy no worse than the required maximum. */
        subject ship : AutonomousShip;
        attribute positionAccuracyMax :> ISQ::length;
        require constraint { ship.positionAccuracy <= positionAccuracyMax }
    }

    requirement def <'SA-002'> AllRoundVisionRequirement {
        doc /* The ship shall have continuous camera coverage around the ship, by day and night and in poor weather, of at least the required horizontal angle. */
        subject ship : AutonomousShip;
        attribute coverageMin : AngularMeasureValue;
        require constraint { ship.cameraCoverage >= coverageMin }
    }

    requirement def <'SA-003'> ObstacleDetectionRangeRequirement {
        doc /* The ship shall detect static and dynamic obstacles at a range no less than the required minimum. */
        subject ship : AutonomousShip;
        attribute detectionRangeMin :> ISQ::length;
        require constraint { ship.obstacleDetectionRange >= detectionRangeMin }
    }

    requirement def <'SA-004'> SoundSignalDetectionRequirement {
        doc /* The ship shall detect, classify and localise COLREGs sound signals from other ships and aids to navigation. */
        subject ship : AutonomousShip;
    }

    requirement def <'SA-005'> UnderKeelClearanceRequirement {
        doc /* The ship shall continuously monitor the water depth below the keel and maintain at least the required minimum under-keel clearance. */
        subject ship : AutonomousShip;
        attribute underKeelClearanceMin :> ISQ::length;
        require constraint { ship.minimumUnderKeelClearance >= underKeelClearanceMin }
    }

    requirement def <'SF-001'> SensorFusionRequirement {
        doc /* The ship shall fuse data from all navigational and situational awareness sensors into one situation picture for situational awareness and collision avoidance. */
        subject ship : AutonomousShip;
    }

    // ------------------------------------------------------------------
    // Collision avoidance
    // ------------------------------------------------------------------

    requirement def <'CA-001'> ColregsComplianceRequirement {
        doc /* The ship shall take collision avoidance actions in compliance with COLREGs Part B for head-on, crossing and overtaking encounters. */
        subject ship : AutonomousShip;
    }

    requirement def <'CA-002'> SafePassingDistanceRequirement {
        doc /* The ship shall keep the closest point of approach to other vessels and obstacles no less than the required minimum passing distance. */
        subject ship : AutonomousShip;
        attribute passingDistanceMin :> ISQ::length;
        require constraint { ship.minimumPassingDistance >= passingDistanceMin }
    }

    requirement def <'CA-003'> HybridPathPlanningRequirement {
        doc /* The ship shall plan a global route around known static obstacles and re-plan the local path in real time around detected obstacles. */
        subject ship : AutonomousShip;
    }

    // ------------------------------------------------------------------
    // Motion control, berthing
    // ------------------------------------------------------------------

    requirement def <'MC-001'> PathFollowingRequirement {
        doc /* The ship shall follow the planned path with a cross-track error no greater than the required maximum under wind, wave and current disturbances. */
        subject ship : AutonomousShip;
        attribute crossTrackErrorMax :> ISQ::length;
        require constraint { ship.maxCrossTrackError <= crossTrackErrorMax }
    }

    requirement def <'MC-002'> DynamicPositioningRequirement {
        doc /* The ship shall hold position under dynamic positioning within the required tolerance. */
        subject ship : AutonomousShip;
        attribute positionHoldToleranceMax :> ISQ::length;
        require constraint { ship.dpPositionHoldTolerance <= positionHoldToleranceMax }
    }

    requirement def <'BRT-001'> BerthingRequirement {
        doc /* The ship shall berth and unberth using dynamic positioning, with an onboard control team embarked for the port approach where required. */
        subject ship : AutonomousShip;
    }

    // ------------------------------------------------------------------
    // Data and communication
    // ------------------------------------------------------------------

    requirement def <'DB-001'> VoyageDataRecordingRequirement {
        doc /* The ship shall record positional, navigational and sensor data for at least the required duration for accident investigation. */
        subject ship : AutonomousShip;
        attribute recordingDurationMin :> ISQ::duration;
        require constraint { ship.vdrRecordingDuration >= recordingDurationMin }
    }

    requirement def <'COM-001'> RemoteCommunicationRequirement {
        doc /* The ship shall exchange status and commands with the remote control centre, and navigation and intention data with other ships and ports. */
        subject ship : AutonomousShip;
    }

    // ------------------------------------------------------------------
    // Specification
    // ------------------------------------------------------------------

    requirement massNavigationSpecification {
        doc /*
         * MASS autonomous navigation specification. The paper gives no numeric targets except
         * DGPS accuracy of 1-10 m and 360-degree vision; the other thresholds are illustrative
         * placeholders to be replaced by the project's own values.
         */
        subject ship : AutonomousShip;

        requirement autonomousVoyage : AutonomousVoyageRequirement {
            :>> requiredAutonomy = DegreeOfAutonomy::doa4;
        }
        requirement operationMode : OperationModeRequirement;
        requirement failsafeFallback : FailsafeFallbackRequirement;
        requirement positionAccuracy : PositionAccuracyRequirement {
            :>> positionAccuracyMax = 10 [m];
        }
        requirement allRoundVision : AllRoundVisionRequirement {
            :>> coverageMin = 360 ['°'];
        }
        requirement obstacleDetectionRange : ObstacleDetectionRangeRequirement {
            :>> detectionRangeMin = 11000 [m];      // illustrative (about 6 nmi)
        }
        requirement soundSignalDetection : SoundSignalDetectionRequirement;
        requirement underKeelClearance : UnderKeelClearanceRequirement {
            :>> underKeelClearanceMin = 1 [m];      // illustrative
        }
        requirement sensorFusion : SensorFusionRequirement;
        requirement colregsCompliance : ColregsComplianceRequirement;
        requirement safePassingDistance : SafePassingDistanceRequirement {
            :>> passingDistanceMin = 1852 [m];      // illustrative (1 nmi)
        }
        requirement hybridPathPlanning : HybridPathPlanningRequirement;
        requirement pathFollowing : PathFollowingRequirement {
            :>> crossTrackErrorMax = 50 [m];        // illustrative
        }
        requirement dynamicPositioning : DynamicPositioningRequirement {
            :>> positionHoldToleranceMax = 3 [m];   // illustrative
        }
        requirement berthing : BerthingRequirement;
        requirement voyageDataRecording : VoyageDataRecordingRequirement {
            :>> recordingDurationMin = 48 [h];      // illustrative
        }
        requirement remoteCommunication : RemoteCommunicationRequirement;
    }
}
