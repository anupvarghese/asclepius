// @flow

/* ::
type resultType = { healthy: bool, name: string, reason: string };
type healthcheckType = () => Promise<resultType>;
type resultsType = { [string]: { healthy: bool, reason: string } };
*/

/* :: type resType = { status: number => ({ json: mixed => mixed }) } */

function timeout(timeoutDelay /* : number */) /* : Promise<void> */ {
  return new Promise(resolve => {
    setTimeout(() => resolve(), timeoutDelay);
  });
}

const response = {
  status: code => ({ json: message => ({ code, message }) }),
};

const reduceResults = results =>
  results.reduce(
    (p, c) =>
      Object.assign(p, { [c.name]: { healthy: c.healthy, reason: c.reason } }),
    {}
  );
const mapInvoke = fs => fs.map(f => f());

function format(results /* : resultsType */) {
  return {
    healthy: !Object.keys(results).some(
      key => results[key] && results[key].healthy === false
    ),
    results,
  };
}

function makeRunner(
  healthchecks /* : Array<healthcheckType> */
) /* : () => Promise<{ healthy: bool, results: resultsType }> */ {
  return () =>
    Promise.all(mapInvoke(healthchecks))
      .then(reduceResults)
      .then(format);
}

function healthcheck(
  name /* : string */,
  check /* : void => Promise<mixed> */,
  timeoutDelay /* : ?number */
) /* : healthcheckType */ {
  const t = timeoutDelay;
  const run =
    typeof t === 'number'
      ? () =>
          Promise.race([
            check(),
            timeout(t).then(() => Promise.reject(`timed out after ${t}ms`)),
          ])
      : check;

  return () =>
    run().then(
      () => ({ healthy: true, name, reason: 'OK' }),
      (reason /* : string */) => ({ healthy: false, name, reason })
    );
}

function makeRoute(healthchecks /* : Array<healthcheckType> */) {
  const runner = makeRunner(healthchecks);

  return (
    req /* : mixed */,
    res /* : resType */ = response,
    next /* : * => void */
  ) =>
    runner()
      .then(
        results =>
          results.healthy
            ? res.status(200).json(results)
            : res.status(500).json(results)
      )
      .catch(next);
}

module.exports = {
  healthcheck,
  timeout,
  makeRunner,
  format,
  makeRoute,
};
