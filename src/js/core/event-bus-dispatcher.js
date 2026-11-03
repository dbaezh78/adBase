/**
 * Bus de Eventos Desacoplado (Pub/Sub).
 * Permite que cada módulo funcione 100% independiente mientras emite o escucha
 * eventos empresariales (ej. POS -> Contabilidad, Nómina -> Contabilidad).
 */

const eventSubscribersMap = new Map();
const emittedEventsHistory = [];

export function subscribeToSystemEvent(eventName, handlerCallback) {
  if (!eventSubscribersMap.has(eventName)) {
    eventSubscribersMap.set(eventName, new Set());
  }
  eventSubscribersMap.get(eventName).add(handlerCallback);
  return () => {
    eventSubscribersMap.get(eventName)?.delete(handlerCallback);
  };
}

export async function publishSystemEvent(eventName, eventPayload = {}) {
  const eventEnvelope = {
    id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    eventName,
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    payload: eventPayload
  };

  emittedEventsHistory.unshift(eventEnvelope);

  const handlers = eventSubscribersMap.get(eventName);
  if (handlers && handlers.size > 0) {
    for (const callback of handlers) {
      await callback(eventPayload, eventEnvelope);
    }
  }

  return eventEnvelope;
}

export function getRecentSystemEventsHistory() {
  return [...emittedEventsHistory];
}
