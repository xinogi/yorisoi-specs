/**
 * LeafIndex — registers the Desk Companion LEAF scenarios (one per done criterion in
 * devpost/design-brief.md, plus DC6 modes + talk list, DC7 pokes, DC8 Ask + translation). Attached to the root SceneObject "LeafIndex" so the module loads.
 */
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {DC1StartAndRecenterScenario} from "./DC1StartAndRecenterScenario"
import {DC2IdleTeaseScenario} from "./DC2IdleTeaseScenario"
import {DC3CallButtonScenario} from "./DC3CallButtonScenario"
import {DC4WordTranslationScenario} from "./DC4WordTranslationScenario"
import {DC5BookHandoffScenario} from "./DC5BookHandoffScenario"
import {DC6ModesAndCueListScenario} from "./DC6ModesAndCueListScenario"
import {DC7PokeMoodScenario} from "./DC7PokeMoodScenario"
import {DC8AskAndTranslateScenario} from "./DC8AskAndTranslateScenario"
import {ViewDeskScenario} from "./ViewDeskScenario"
import {DC9StretchScenario} from "./DC9StretchScenario"
import {DC10SecretaryScenario} from "./DC10SecretaryScenario"
import {DemoReelScenario} from "./DemoReelScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {
      id: "dc1-start-and-recenter",
      typename: DC1StartAndRecenterScenario.getTypeName(),
      parameters: {turnMode: "leafHead", disableDeviceTracking: "true", recenterLimitMs: "2000"}
    },
    {
      id: "dc2-idle-tease",
      typename: DC2IdleTeaseScenario.getTypeName(),
      parameters: {teaseSeconds: "3"}
    },
    {
      id: "dc3-call-button",
      typename: DC3CallButtonScenario.getTypeName(),
      parameters: {arriveLimitMs: "2500"}
    },
    {
      id: "dc4-word-translation",
      typename: DC4WordTranslationScenario.getTypeName(),
      parameters: {word: "bara", holdSeconds: "8"}
    },
    {
      id: "dc5-book-handoff",
      typename: DC5BookHandoffScenario.getTypeName(),
      parameters: {handoffMode: "holdOut"}
    },
    {
      id: "dc6-modes-and-cue-list",
      typename: DC6ModesAndCueListScenario.getTypeName(),
      parameters: {timeScale: "20"}
    },
    {
      id: "dc7-poke-mood",
      typename: DC7PokeMoodScenario.getTypeName(),
      parameters: {}
    },
    {
      id: "dc8-ask-and-translate",
      typename: DC8AskAndTranslateScenario.getTypeName(),
      parameters: {word: "bara"}
    },
    {
      id: "dc9-stretch",
      typename: DC9StretchScenario.getTypeName(),
      parameters: {timeScale: "3"}
    },
    {
      id: "dc10-secretary",
      typename: DC10SecretaryScenario.getTypeName(),
      parameters: {timeScale: "10"}
    },
    {
      // hands-free demo video driver (devpost/video-script.md); not a done criterion
      id: "demo-reel",
      typename: DemoReelScenario.getTypeName(),
      parameters: {}
    },
    {
      id: "view-desk",
      typename: ViewDeskScenario.getTypeName(),
      parameters: {pitchDeg: "-50", holdSeconds: "10"}
    }
  ]
}
