import React from "react";
import { render } from "@testing-library/react";
import {JSONResults} from "./JSONResults";
import {expect, it, describe} from "vitest";

describe("JSONResults", () => {
    it("renders JSON results", () => {
        const { getByRole } = render(
            <JSONResults
                results={{ data: { test: "test" } }}
            />
        );

        expect(getByRole("log")).toBeInTheDocument();
        expect(getByRole("log")).toHaveTextContent('{ "data": { "test": "test" } }');
    });

    it("renders no results", () => {
        const { getByRole } = render(
            <JSONResults results={undefined} />
        );

        expect(getByRole("log")).toBeInTheDocument();
        expect(getByRole("log")).toHaveTextContent('No results yet');
    });
});