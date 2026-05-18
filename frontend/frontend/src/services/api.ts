import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000/api",
});

console.log(API.defaults.baseURL);
export default API;
