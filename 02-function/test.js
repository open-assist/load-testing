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

  // create thread
  res = http.post(`${__ENV.BASE_URL}/v1/threads`, JSON.stringify({}), {
    headers,
  });
  check(res, {
    "thread ware created": (r) => r.status === 201,
  });
  if (res.status >= 400) {
    console.error(res.json());
    return;
  }
  const threadId = res.json()["id"];
  console.log("[thread] id", threadId);

  // create message
  res = http.post(
    `${__ENV.BASE_URL}/v1/threads/${threadId}/messages`,
    JSON.stringify(messages[messages.length - 1]),
    {
      headers,
    }
  );
  check(res, {
    "is status 201": (r) => r.status === 201,
  });
  console.log("[message] id:", res.json()["id"]);

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
    "is status 201": (r) => r.status === 201,
  });

  let run = res.json();
  console.log("[run] id:", run["id"]);

  while (true) {
    sleep(3);
    res = http.get(
      `${__ENV.BASE_URL}/v1/threads/${threadId}/runs/${run["id"]}`,
      {
        headers,
      }
    );
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
      console.log("[run] done:", run);
      break;
    }
  }

  if (run["status"] === "requires_action") {
    // submit tool outputs
    const output =
      '{"movie":"Barbie","theaters":[{"name":"AMC Mountain View 16","address":"2000 W El Camino Real, Mountain View, CA 94040"},{"name":"Regal Edwards 14","address":"245 Castro St, Mountain View, CA 94040"}]}';
    res = http.post(
      `${__ENV.BASE_URL}/v1/threads/${threadId}/runs/${run["id"]}/submit_tool_outputs`,
      JSON.stringify({
        tool_outputs: [
          {
            tool_call_id:
              run["required_action"]["submit_tool_outputs"]["tool_calls"][0][
                "id"
              ],
            output,
          },
        ],
      }),
      { headers }
    );
    run = res.json();
    console.log("[run] status:", run["status"]);

    while (true) {
      sleep(3);
      res = http.get(
        `${__ENV.BASE_URL}/v1/threads/${threadId}/runs/${run["id"]}`,
        {
          headers,
        }
      );
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
        console.log("[run] done:", run);
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
