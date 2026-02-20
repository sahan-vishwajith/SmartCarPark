export const getToken = () => localStorage.getItem("authToken");

export const requireTokenOrAlert = () => {
  const token = getToken();
  if (!token) {
    alert("Please login first.");
    return null;
  }
  return token;
};
