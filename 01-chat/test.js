import { check, sleep } from "k6";
import http from "k6/http";
import { headers } from "../common.js";
import { SharedArray } from "k6/data";

const assistants = new SharedArray("assistants.json", function () {
  return JSON.parse(open("./assistants.json"));
});
const messages = new SharedArray("messages.json", function () {
  return JSON.parse(open("./messages.json"));
});

export default function () {
  // create assistant
  let res = http.post(
    `${__ENV.BASE_URL}/v1/assistants`,
    JSON.stringify(assistants[0]),
    {
      headers,
    }
  );
  check(res, {
    "assistant was created": (r) => r.status === 201,
  });
  if (res.status >= 400) {
    console.error(res.json());
    return;
  }
  const assistantId = res.json()["id"];
  console.log("[assistant] id", assistantId);

  // create thread and messages
  res = http.post(
    `${__ENV.BASE_URL}/v1/threads`,
    JSON.stringify({ messages }),
    {
      headers,
    }
  );
  check(res, {
    "thread and messages ware created": (r) => r.status === 201,
  });
  if (res.status >= 400) {
    console.error(res.json());
    return;
  }
  const threadId = res.json()["id"];
  console.log("[thread] id", threadId);

  // create run
  res = http.post(
    `${__ENV.BASE_URL}/v1/threads/${threadId}/runs`,
    JSON.stringify({
      assistant_id: assistantId,
    }),
    {
      headers,
    }
  );
  check(res, {
    "run was created": (r) => r.status === 201,
  });
  if (res.status >= 400) {
    console.error(res.json());
    return;
  }

  let run = res.json();
  const runId = run["id"];
  console.log("[run] status:", run["status"]);

  while (true) {
    sleep(3);

    res = http.get(`${__ENV.BASE_URL}/v1/threads/${threadId}/runs/${runId}`, {
      headers,
    });
    run = res.json();
    console.log("[run] status:", run["status"]);
    if (
      [
        "completed",
        "failed",
        "requires_action",
        "expired",
        "cancelled",
      ].includes(run["status"])
    ) {
      break;
    }
  }

  if (run["status"] === "completed") {
    res = http.get(
      `${__ENV.BASE_URL}/v1/threads/${threadId}/messages?limit=1`,
      {
        headers,
      }
    );
    const message = res.json()["data"][0];
    if (message) {
      console.log("[message] reply id:", message["id"]);
      console.log(
        "[message] reply content:",
        JSON.stringify(message["content"])
      );
    }
  }
  if (run["status"] === "failed") {
    console.log(run["last_error"]);
  }

  // delete thread
  res = http.del(`${__ENV.BASE_URL}/v1/threads/${threadId}`, undefined, {
    headers,
  });
  check(res, {
    "deleted thread": (r) => r.status === 200,
  });

  // delete assistant
  res = http.del(`${__ENV.BASE_URL}/v1/assistants/${assistantId}`, undefined, {
    headers,
  });
  check(res, {
    "deleted assistant": (r) => r.status === 200,
  });
}
