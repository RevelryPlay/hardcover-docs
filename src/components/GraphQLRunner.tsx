import React, {useEffect, useState} from "react";
import {GRAPHQL_URL} from "../Consts";

import {Button} from "@/components/ui/button.tsx";

export const GraphQLRunner = (props: {
    query: string,
    description?: string,
    presentation?: 'auto' | 'json' | 'table',
}) => {
    const {description} = props;

    // Get the query from props so we can modify it
    const [query, setQuery] = useState(props.query);

    // Get the auth token and user_id from local storage if it exists
    const localAuthToken = window.localStorage.getItem('auth_token');
    const [userId, setUserId] = useState(window.localStorage.getItem('user_id') || '');
    const [authToken, setAuthToken] = useState(localAuthToken || '');

    // If the query is a mutation, we don't allow it to be run here, and instead we will show a message to the user
    const isMutation = query.trim().toLowerCase().includes('mutation');

    // If the query has been run, we need to store the results in the React state
    const [queryStatus, setQueryStatus] = useState<'running' | 'success' | 'error' | 'idle'>('idle');
    const [queryError, setQueryError] = useState<string | undefined>();
    const [queryResults, setQueryResults] = useState<any>(null);

    /**
     * This function will replace the ##USER_ID## token in the query with the actual user_id.
     * Additional tokens can be added here as needed.
     * @param query - string
     * @returns {string}
     */
    const ReplaceQueryTokens = (query: string): string => {
        if (!!userId) {
            // Replace the user_id token with the actual user_id
            query.replace(/##USER_ID##/g, userId);
        }

        return query;
    }

    useEffect(() => {
        // Replace the tokens in the query
        // Use the original query from props to ensure can this can be re-run if data changes
        setQuery(ReplaceQueryTokens(props.query));
    }, [userId]);

    /**
     * This function will handle the query using fetch.
     * In an actual application, you would want to use something like apollo-client to handle this.
     * @param runningQuery - string
     * @returns {Promise<any>}
     */
    const handleQueryWithFetch = (runningQuery: string | undefined): { then(resolve: any, reject: any): void; } => {
        return {
            then(resolve: any, reject: any) {
                // Ensure the auth token is provided
                if (!authToken || !authToken.trim()) {
                    reject(new Error('No auth token provided'));
                    return;
                }

                // If the query is a mutation, we don't allow it to be run here, and instead we will show a message to the user
                if (isMutation) {
                    reject(new Error('This is a mutation query.'));
                    return;
                }

                // Ensure the query is not empty
                if (!runningQuery || !runningQuery.trim()) {
                    reject(new Error('Query is empty'));
                    return;
                }

                // Call the GraphQL endpoint with the query using fetch
                fetch(GRAPHQL_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authToken.startsWith('Bearer')
                            ? authToken : `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        query: runningQuery
                    })
                }).then(res => {
                    // If the response is not ok, reject the promise
                    if (!res.ok) {
                        reject(new Error('Error running query'));
                        return;
                    }

                    // Parse the JSON response
                    res.json().then(data => {
                        // If there is an error in the response, reject the promise
                        if (data.error) {
                            console.error({error: data.error});
                            reject(new Error(data.error));
                        }

                        if (data.errors) {
                            console.error({errors: data.errors});

                            // If there is a message in the errors, reject the promise with the message
                            if (data.errors[0].message) {
                                reject(new Error(data.errors[0].message));
                                return;
                            }

                            // If there is no message, reject the promise a generic error message
                            reject(new Error('Error running query'));
                        }

                        // Return the data from the query
                        resolve(data);
                    });
                }, () => {
                    // If there is an error with the fetch request, reject the promise
                    reject(new Error('Error connecting to server'));
                });
            }
        };
    };

    /**
     * This function will handle the onChange event for the auth token input field.
     * We need to update the auth token in the React state to be able to display it.
     * @param event - React.ChangeEvent<HTMLInputElement>
     * @returns {void}
     */
    const updateAuthTokenUI = (event: React.ChangeEvent<HTMLInputElement>): void => {
        // Get the new auth token from the input field and trim it
        const newAuthToken = event.target?.value?.trim();

        // Update the React state with the new auth token to be able to display it
        setAuthToken(newAuthToken);
    }

    /**
     * This function will handle the onBlur event for the auth token input field.
     * We are using blur instead of change to ensure the user has finished typing before we test the auth token.
     * @param event - React.ChangeEvent<HTMLInputElement>
     * @returns {void}
     */
    const handleAuthTokenChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        // Get the new auth token from the input field and trim it
        // This should be handled by the updateAuthTokenUI function,
        // but we are doing it here as well to be safe
        const newAuthToken = event.target?.value?.trim();

        // Query to get the user's ID
        const userIdQuery = `
            query {
                me {
                    id
                }
            }
        `;

        // Test the auth token to ensure it is valid and get the user's ID while we are at it
        handleQueryWithFetch(userIdQuery).then((res: any) => {
            // If the return data does not have the "me" object, the auth token is invalid
            if (!res?.data?.me) {
                console.error('Invalid auth token');
                return;
            }

            // Only update the local storage if the auth token is valid
            window.localStorage.setItem('auth_token', newAuthToken);
            // Update the local storage with the user's ID as well to be able to use it later
            // Note: the "me" object is an array, so we need to get the first item
            window.localStorage.setItem('user_id', res.data.me[0].id);

            // Update the React state with the user's ID, so we can use it for the limit to my account filter
            setUserId(res.data.me[0].id);

        }, (err: { message: string; }) => {
            console.error('Error running query to test auth token', {err: err.message});
        });
    };

    /**
     * This function will handle the onClick event for the Run Query button.
     * We need to run the query and display the results.
     * @returns {void}
     */
    const handleRunQuery = (): void => {
        // In this version we are running the unmodified query
        // In a future version we will add the filters to the query for the limit to my account
        // and results length options

        // Set the query status to running
        setQueryStatus('running');

        // Run the query using fetch
        handleQueryWithFetch(query).then((res: any) => {
                // Update the React state with the results
                setQueryResults(res.data);

                // Set the query status to success
                setQueryStatus('success');
            },
            (err: { message: string; }) => {
                // Update the React state with the error message
                setQueryError(err.message);

                // Set the query status to error
                setQueryStatus('error');
            });
    };

    // Render the component
    // This is a first draft and will be updated as we go along
    return (
        <>
            {isMutation && (
                <div className="relative my-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
                     role="alert">
                    <strong className="font-bold">Warning!</strong>
                    <span className="block sm:inline"> This is a mutation query. You cannot run this query here.</span>
                </div>
            )}
            {!isMutation && (
                <>
                    <label htmlFor="auth_token"
                           className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                        Authorization Token
                    </label>

                    <input type="text"
                           id="auth_token"
                           className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 mb-4
                                focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600
                                dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                           onChange={updateAuthTokenUI}
                           onBlur={handleAuthTokenChange}
                           title="This is your authorization token. You can find this in your account settings."
                           value={authToken}
                           required/>

                    <Button
                            onClick={handleRunQuery}
                            title="Run the query displayed below"
                            variant="default"
                    >
                        Run Query
                    </Button>

                    {(queryStatus == "idle" || !queryStatus) && (
                        <div className="my-4 w-full rounded-lg p-3 text-gray-900 bg-accent-200">
                            This will run against your account.<br/>
                            You are responsible for the content of any queries ran on your account.
                        </div>
                    )}

                    {queryStatus == "running" && (
                        <div className="my-4 w-full rounded-lg p-3 text-gray-900 bg-accent-200">
                            Loading...
                        </div>
                    )}

                    {queryStatus == "error" && (
                        <div className="my-4 w-full rounded-lg border border-red-400 bg-red-100 p-3 text-red-700">
                            <strong>Error: </strong> {queryError}
                        </div>
                    )}

                    {queryStatus == "success" && (
                        <div className="my-4 w-full rounded-lg border border-green-400 bg-green-100 p-3 text-green-700">
                            Success!
                        </div>
                    )}

                    <div className="">
                        <h2 className="my-4 text-lg font-semibold text-gray-900 dark:text-white">Query</h2>

                        {description && (
                            <p className="my-4 text-sm text-gray-900 dark:text-white">{description}</p>
                        )}

                        <pre className="bg-slate-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5
                                dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white">
                            {query}
                        </pre>

                        <h2 className="my-4 text-lg font-semibold text-gray-900 dark:text-white">Results</h2>

                        <pre className="bg-slate-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5
                                dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white">
                            {queryResults ? JSON.stringify(queryResults, null, 2) : "No results yet"}
                        </pre>
                    </div>
                </>
            )}
        </>
    );
};