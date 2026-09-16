const KEY = "drivon.passenger.deviceId";

/** Um id estável por instalação, gerado uma vez e guardado localmente. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
