import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getStateFromPath, getPathFromState } from "@react-navigation/core";

const linkingConfig = {
  screens: {
    Main: {
      screens: {
        HomeTab: "home",
        LibraryTab: {
          screens: {
            LearnHome: "library",
            Chapters: "library/book/:bookId",
            Topics: "library/chapter/:chapterId",
          },
        },
        QuizTab: "quiz",
        ProgressTab: "progress",
        ProfileTab: "profile",
      },
    },
    TopicReader: "topic/:topicId",
    QuizPlayer: "quiz/play/:mode",
    QuizResults: "quiz/results/:resultId",
    ResetPassword: "reset-password",
    Subscription: "subscribe",
    Bookmarks: "bookmarks",
  },
};

const WEB_APP_BASE_PATH = "/app";

function stripHostedWebBasePath(path: string, isHostedWeb: boolean = false) {
  if (!isHostedWeb) {
    return path;
  }
  if (path === WEB_APP_BASE_PATH) {
    return "/";
  }
  if (path.startsWith(`${WEB_APP_BASE_PATH}/`)) {
    return path.slice(WEB_APP_BASE_PATH.length);
  }
  return path;
}

function resolveState(path: string, isHostedWeb: boolean = false) {
  const stripped = stripHostedWebBasePath(path, isHostedWeb);
  return getStateFromPath(stripped, linkingConfig);
}

describe("Client Deep Linking Schema Verification", () => {
  it("resolves /library correctly to Main -> LibraryTab -> LearnHome", () => {
    const state = resolveState("/library");
    assert(state, "State should be defined");
    assert.equal(state.routes[0].name, "Main");
    const mainRoute = state.routes[0] as any;
    const libRoute = mainRoute.state.routes[mainRoute.state.index ?? 0];
    assert.equal(libRoute.name, "LibraryTab");
    const learnRoute = libRoute.state.routes[libRoute.state.index ?? 0];
    assert.equal(learnRoute.name, "LearnHome");
  });

  it("resolves /library/book/:bookId to Main -> LibraryTab -> Chapters", () => {
    const state = resolveState("/library/book/bk-101");
    assert(state, "State should be defined");
    assert.equal(state.routes[0].name, "Main");
    const mainRoute = state.routes[0] as any;
    const libRoute = mainRoute.state.routes[mainRoute.state.index ?? 0];
    assert.equal(libRoute.name, "LibraryTab");
    const chaptersRoute = libRoute.state.routes[libRoute.state.index ?? 0];
    assert.equal(chaptersRoute.name, "Chapters");
    assert.deepEqual(chaptersRoute.params, { bookId: "bk-101" });
  });

  it("resolves /library/chapter/:chapterId to Main -> LibraryTab -> Topics", () => {
    const state = resolveState("/library/chapter/ch-202");
    assert(state, "State should be defined");
    assert.equal(state.routes[0].name, "Main");
    const mainRoute = state.routes[0] as any;
    const libRoute = mainRoute.state.routes[mainRoute.state.index ?? 0];
    assert.equal(libRoute.name, "LibraryTab");
    const topicsRoute = libRoute.state.routes[libRoute.state.index ?? 0];
    assert.equal(topicsRoute.name, "Topics");
    assert.deepEqual(topicsRoute.params, { chapterId: "ch-202" });
  });

  it("resolves root level deep links correctly", () => {
    const topicState = resolveState("/topic/top-999");
    assert(topicState, "Topic state should be defined");
    assert.equal(topicState.routes[0].name, "TopicReader");
    assert.deepEqual(topicState.routes[0].params, { topicId: "top-999" });

    const quizState = resolveState("/quiz/play/exam");
    assert(quizState, "Quiz state should be defined");
    assert.equal(quizState.routes[0].name, "QuizPlayer");
    assert.deepEqual(quizState.routes[0].params, { mode: "exam" });

    const quizResState = resolveState("/quiz/results/res-456");
    assert(quizResState, "Quiz results state should be defined");
    assert.equal(quizResState.routes[0].name, "QuizResults");
    assert.deepEqual(quizResState.routes[0].params, { resultId: "res-456" });

    const resetState = resolveState("/reset-password");
    assert(resetState, "Reset state should be defined");
    assert.equal(resetState.routes[0].name, "ResetPassword");

    const subState = resolveState("/subscribe");
    assert(subState, "Sub state should be defined");
    assert.equal(subState.routes[0].name, "Subscription");

    const bkmkState = resolveState("/bookmarks");
    assert(bkmkState, "Bookmarks state should be defined");
    assert.equal(bkmkState.routes[0].name, "Bookmarks");
  });

  it("resolves hosted web base path prefix correctly", () => {
    const hostedLibState = resolveState("/app/library", true);
    assert(hostedLibState, "Hosted state should be defined");
    assert.equal(hostedLibState.routes[0].name, "Main");

    const hostedTopicState = resolveState("/app/topic/top-123", true);
    assert(hostedTopicState, "Hosted topic state should be defined");
    assert.equal(hostedTopicState.routes[0].name, "TopicReader");
    assert.deepEqual(hostedTopicState.routes[0].params, { topicId: "top-123" });
  });

  it("handles URL encoded params and query strings robustly", () => {
    const encodedTopicState = resolveState("/topic/topic%20with%20spaces?ref=dashboard");
    assert(encodedTopicState, "Topic state should be defined");
    assert.equal(encodedTopicState.routes[0].name, "TopicReader");
    assert.equal((encodedTopicState.routes[0].params as any)?.topicId, "topic with spaces");

    const queryQuizState = resolveState("/quiz/play/topic?topicId=top-10&questionCount=20");
    assert(queryQuizState, "Quiz player state should be defined");
    assert.equal(queryQuizState.routes[0].name, "QuizPlayer");
    assert.deepEqual(queryQuizState.routes[0].params, {
      mode: "topic",
      topicId: "top-10",
      questionCount: "20",
    });
  });

  it("generates correct URL from state via getPathFromState", () => {
    const navState = {
      routes: [
        {
          name: "Main",
          state: {
            routes: [
              {
                name: "LibraryTab",
                state: {
                  routes: [{ name: "LearnHome" }],
                },
              },
            ],
          },
        },
      ],
    };
    const path = getPathFromState(navState as any, linkingConfig);
    assert.equal(path, "/library");
  });

  it("demonstrates the failure if old 'Books' screen route was still used", () => {
    const brokenConfig = {
      screens: {
        Main: {
          screens: {
            LibraryTab: {
              screens: {
                Books: "library",
              },
            },
          },
        },
      },
    };
    const resolved = getStateFromPath("/library", brokenConfig as any);
    const mainRoute = resolved?.routes[0] as any;
    const libRoute = mainRoute.state.routes[mainRoute.state.index ?? 0];
    const screenRoute = libRoute.state.routes[libRoute.state.index ?? 0];
    assert.equal(screenRoute.name, "Books");
    assert.notEqual(screenRoute.name, "LearnHome");
  });
});
