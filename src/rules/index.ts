/** Every rule of the plugin, by name. `src/configs.ts` says which config each one is in. */
import type { CleanCodeRule } from "../lib/define-rule.ts";
import aiNoCeremonialCatch from "./ai/ai-no-ceremonial-catch.ts";
import aiNoEmoji from "./ai/ai-no-emoji.ts";
import aiNoInlineComments from "./ai/ai-no-inline-comments.ts";
import aiNoPlaceholderImplementation from "./ai/ai-no-placeholder-implementation.ts";
import aiNoPlaceholderValues from "./ai/ai-no-placeholder-values.ts";
import errorHandlingIsOneThing from "./error-handling-is-one-thing.ts";
import fieldsFirst from "./fields-first.ts";
import lawOfDemeter from "./law-of-demeter.ts";
import loopVariableInLoop from "./loop-variable-in-loop.ts";
import maxBlockStatements from "./max-block-statements.ts";
import nameLengthMatchesScope from "./name-length-matches-scope.ts";
import noAttributionComments from "./no-attribution-comments.ts";
import noCommandQueryMix from "./no-command-query-mix.ts";
import noCommentedOutCode from "./no-commented-out-code.ts";
import noComplexCondition from "./no-complex-condition.ts";
import noConcreteInheritance from "./no-concrete-inheritance.ts";
import noContainerInName from "./no-container-in-name.ts";
import noDisabledTests from "./no-disabled-tests.ts";
import noEncodings from "./no-encodings.ts";
import noFlagArgument from "./no-flag-argument.ts";
import noGetterChains from "./no-getter-chains.ts";
import noHtmlInComments from "./no-html-in-comments.ts";
import noHybridClass from "./no-hybrid-class.ts";
import noJournalComments from "./no-journal-comments.ts";
import noMutableStaticState from "./no-mutable-static-state.ts";
import noNoiseWords from "./no-noise-words.ts";
import noNumberSeriesNames from "./no-number-series-names.ts";
import noOverloadedConstructors from "./no-overloaded-constructors.ts";
import noPositionMarkers from "./no-position-markers.ts";
import noProtectedFields from "./no-protected-fields.ts";
import noPureDelegator from "./no-pure-delegator.ts";
import noRedundantComments from "./no-redundant-comments.ts";
import noSharedTestState from "./no-shared-test-state.ts";
import noSideEffectsInPredicates from "./no-side-effects-in-predicates.ts";
import noSubtypeCheck from "./no-subtype-check.ts";
import nodeExitAfterFatalError from "./node/node-exit-after-fatal-error.ts";
import nodeNoErrorMessageMatching from "./node/node-no-error-message-matching.ts";
import nodeNoRecursiveNextTick from "./node/node-no-recursive-next-tick.ts";
import nodeNoSyncInHandler from "./node/node-no-sync-in-handler.ts";
import noTrivialAccessors from "./no-trivial-accessors.ts";
import oneSwitchPerType from "./one-switch-per-type.ts";
import predicateReturnsBoolean from "./predicate-returns-boolean.ts";
import reactNoStateMutation from "./react/react-no-state-mutation.ts";
import reactNoUntypedEmptyState from "./react/react-no-untyped-empty-state.ts";
import returnBooleanDirectly from "./return-boolean-directly.ts";
import stepdownOrder from "./stepdown-order.ts";
import testAsserts from "./test-asserts.ts";
import tsNoAmdDependency from "./typescript/ts-no-amd-dependency.ts";
import tsNoDefiniteAssignmentAssertion from "./typescript/ts-no-definite-assignment-assertion.ts";
import tsNoModuleAugmentation from "./typescript/ts-no-module-augmentation.ts";

export const rules: Record<string, CleanCodeRule> = {
  "ai-no-ceremonial-catch": aiNoCeremonialCatch,
  "ai-no-emoji": aiNoEmoji,
  "ai-no-inline-comments": aiNoInlineComments,
  "ai-no-placeholder-implementation": aiNoPlaceholderImplementation,
  "ai-no-placeholder-values": aiNoPlaceholderValues,
  "error-handling-is-one-thing": errorHandlingIsOneThing,
  "fields-first": fieldsFirst,
  "law-of-demeter": lawOfDemeter,
  "loop-variable-in-loop": loopVariableInLoop,
  "max-block-statements": maxBlockStatements,
  "name-length-matches-scope": nameLengthMatchesScope,
  "no-attribution-comments": noAttributionComments,
  "no-command-query-mix": noCommandQueryMix,
  "no-commented-out-code": noCommentedOutCode,
  "no-complex-condition": noComplexCondition,
  "no-concrete-inheritance": noConcreteInheritance,
  "no-container-in-name": noContainerInName,
  "no-disabled-tests": noDisabledTests,
  "no-encodings": noEncodings,
  "no-flag-argument": noFlagArgument,
  "no-getter-chains": noGetterChains,
  "no-html-in-comments": noHtmlInComments,
  "no-hybrid-class": noHybridClass,
  "no-journal-comments": noJournalComments,
  "no-mutable-static-state": noMutableStaticState,
  "no-noise-words": noNoiseWords,
  "no-number-series-names": noNumberSeriesNames,
  "no-overloaded-constructors": noOverloadedConstructors,
  "no-position-markers": noPositionMarkers,
  "no-protected-fields": noProtectedFields,
  "no-pure-delegator": noPureDelegator,
  "no-redundant-comments": noRedundantComments,
  "no-shared-test-state": noSharedTestState,
  "no-side-effects-in-predicates": noSideEffectsInPredicates,
  "no-subtype-check": noSubtypeCheck,
  "no-trivial-accessors": noTrivialAccessors,
  "node-exit-after-fatal-error": nodeExitAfterFatalError,
  "node-no-error-message-matching": nodeNoErrorMessageMatching,
  "node-no-recursive-next-tick": nodeNoRecursiveNextTick,
  "node-no-sync-in-handler": nodeNoSyncInHandler,
  "one-switch-per-type": oneSwitchPerType,
  "predicate-returns-boolean": predicateReturnsBoolean,
  "react-no-state-mutation": reactNoStateMutation,
  "react-no-untyped-empty-state": reactNoUntypedEmptyState,
  "return-boolean-directly": returnBooleanDirectly,
  "stepdown-order": stepdownOrder,
  "test-asserts": testAsserts,
  "ts-no-amd-dependency": tsNoAmdDependency,
  "ts-no-definite-assignment-assertion": tsNoDefiniteAssignmentAssertion,
  "ts-no-module-augmentation": tsNoModuleAugmentation,
};
