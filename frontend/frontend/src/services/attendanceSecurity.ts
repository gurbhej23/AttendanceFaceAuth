export interface AttendanceLocation {
  latitude?: number;
  longitude?: number;
}

export const getCurrentLocation = (): Promise<AttendanceLocation> =>
  Promise.race([
    new Promise<AttendanceLocation>((resolve) => {
      if (!navigator.geolocation) {
        resolve({});
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        () => resolve({}),
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 30000,
        },
      );
    }),
    new Promise<AttendanceLocation>((resolve) => {
      window.setTimeout(() => resolve({}), 5000);
    }),
  ]);

export const livenessPrompts = [
  "Blink once, then keep your face steady",
  "Turn your head slightly left, then face front",
  "Turn your head slightly right, then face front",
];

export const pickLivenessPrompt = () =>
  livenessPrompts[Math.floor(Math.random() * livenessPrompts.length)];
