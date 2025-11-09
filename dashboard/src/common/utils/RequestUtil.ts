export const request = async (
    url: string,
    method: any,
    body: any,
    headers: HeadersInit | undefined,
) => {
    url = url.startsWith("/") ? url.substring(1) : url;

    const response = await fetch(`/api/${url}`, {
        method: method,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (response.status === 401) throw new Error("Unauthorized");

    const rawData = await response.text();
    const data = rawData ? JSON.parse(rawData) : rawData.toString();

    if (data.code >= 300) throw data;

    if (!response.ok) throw data;

    return data;
};
const getToken = () => {
    return localStorage.getItem("sessionToken");
};

export const sessionRequest = (
    url: string,
    method: string,
    token: string | null,
    body: object | undefined = {},
) => {
    return request(url, method, body, { Authorization: `Bearer ${token}` });
};

export const getRequest = (url: string) => {
    return sessionRequest(url, "GET", getToken());
};

export const postRequest = (url: string, body: object | undefined) => {
    return sessionRequest(url, "POST", getToken(), body);
};

export const putRequest = (url: string, body: object | undefined) => {
    return sessionRequest(url, "PUT", getToken(), body);
};

export const deleteRequest = (url: string) => {
    return sessionRequest(url, "DELETE", getToken());
};

export const patchRequest = (url: string, body: object | undefined) => {
    return sessionRequest(url, "PATCH", getToken(), body);
};
