package MaritimeAutonomousSurfaceShip {
    doc /*
     * Maritime Autonomous Surface Ship (MASS): autonomous navigation system model.
     *
     * Source: Alamoush, A.S.; Ölçer, A.I. "Maritime Autonomous Surface Ships:
     * Architecture for Autonomous Navigation Systems". J. Mar. Sci. Eng. 2025, 13, 122.
     * https://doi.org/10.3390/jmse13010122
     *
     * The model follows the paper's architecture (Figure 1): a decision-making and
     * action-taking system (situational awareness, collision avoidance, control)
     * sits on top of the vessel platform (sensors, sensor fusion, database,
     * machinery, actuators) and communicates with a remote control centre (RCC),
     * other ships and ports.
     *
     * Package map:
     *   structure/       ShipDataItems, ShipPorts, SensorSystems, NavigationSystems,
     *                    VesselPlatform, ShipArchitecture, OperationalContext
     *   behaviour/       AutonomousNavigation, FailsafeFallback, ShipStates,
     *                    NavigationCalculations, ShipUseCases
     *   requirements/    NavigationRequirements
     *   configurations/  ShipConfiguration
     *   verification/    NavigationVerification
     *   views/           ShipViews
     */

    private import ShipDataItems::*;
    private import ShipPorts::*;
    private import SensorSystems::*;
    private import NavigationSystems::*;
    private import VesselPlatform::*;
    private import ShipArchitecture::*;
    private import OperationalContext::*;
    private import AutonomousNavigation::*;
    private import FailsafeFallback::*;
    private import ShipStates::*;
    private import NavigationCalculations::*;
    private import ShipUseCases::*;
    private import NavigationRequirements::*;
    private import ShipConfiguration::*;
    private import NavigationVerification::*;
    private import ShipViews::*;
}
