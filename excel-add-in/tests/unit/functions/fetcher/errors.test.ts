import { VITE_PLATFORM_URL } from "~/constants";
import OBBExcelError, { CFError, handleErrors } from "~/functions/fetcher/errors";

jest.mock("~/constants", () => ({ VITE_PLATFORM_URL: "http://platform.test" }));

test("handleErrors.objectLen1", () => {
  const errorResponse = {
    detail: [
      {
        type: "missing",
        loc: ["query", "query"],
        msg: "Field required",
        input: null,
        url: "https://errors.pydantic.dev/2.5/v/missing",
      },
    ],
  };
  expect(() => {
    handleErrors(errorResponse);
  }).toThrow("query -> Field required");
});

test("handleErrors.objectLen2", () => {
  const errorResponse = {
    detail: [
      {
        type: "literal_error",
        loc: ["query", "provider"],
        msg: "Input should be 'fmp' or 'polygon'",
        input: "a",
        ctx: {
          expected: "'fmp' or 'polygon'",
        },
        url: "https://errors.pydantic.dev/2.5/v/literal_error",
      },
      {
        type: "literal_error",
        loc: ["query", "period"],
        msg: "Input should be 'annual' or 'quarter'",
        input: "b",
        ctx: {
          expected: "'annual' or 'quarter'",
        },
        url: "https://errors.pydantic.dev/2.5/v/literal_error",
      },
    ],
  };
  expect(() => {
    handleErrors(errorResponse);
  }).toThrow(
    "provider -> Input should be 'fmp' or 'polygon';\nperiod -> Input should be 'annual' or 'quarter'",
  );
});

test("handleErrors.stringObject1", () => {
  const errorResponse = {
    detail:
      "1 validation error for FMPEquityHistoricalQueryParams\ninterval\n  Input should be '1m', '5m', '15m', '30m', '1h', '4h' or '1d' [type=literal_error, input_value='xx', input_type=str]\n    For further information visit https://errors.pydantic.dev/2.5/v/literal_error",
  };
  expect(() => {
    handleErrors(errorResponse);
  }).toThrow(
    "interval ->   Input should be '1m', '5m', '15m', '30m', '1h', '4h' or '1d'",
  );
});

test("handleErrors.stringObject2", () => {
  const errorResponse = {
    detail: `[{'type': 'literal_error', 'loc': ('query', 'provider'), 'msg': "Input should be 'fmp', 'polygon' or 'tiingo'", 'input': 'f', 'ctx': {'expected': "'fmp', 'polygon' or 'tiingo'"}, 'url': 'https://errors.pydantic.dev/2.6/v/literal_error'}]`,
  };
  expect(() => {
    handleErrors(errorResponse);
  }).toThrow('provider -> Input should be "fmp", "polygon" or "tiingo"');
});

test("handleErrors.stringPure", () => {
  const errorResponse = {
    detail:
      "Error in FMP request -> Required String parameter 'date' is not present",
  };
  expect(() => {
    handleErrors(errorResponse);
  }).toThrow(
    "Error in FMP request -> Required String parameter 'date' is not present",
  );
});

test("handleErrors.fallBack", () => {
  const errorResponse = { detail: null };
  expect(() => {
    handleErrors(errorResponse);
  }).toThrow("Failed to fetch data.");
});

test("handleErrors.invalidToken", () => {
  const errorResponse = { detail: "test error" };
  expect(() => {
    handleErrors(errorResponse, 401, VITE_PLATFORM_URL);
  }).toThrow("Sign in with Pro account.");
});

test("OBBExcelErrorRandomError", () => {
  const error = new Error("This is an error message");
  expect(() => {
    OBBExcelError(error);
  }).toThrow("This is an error message");
});

test("OBBExcelErrorCFError", () => {
  const error = CFError("This is an error message");
  const result = OBBExcelError(error);
  expect(result).toEqual([["#OBB!: This is an error message"]]);
});
