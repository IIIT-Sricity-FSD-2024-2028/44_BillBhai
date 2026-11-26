import { useCallback, useEffect, useId } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clearViewValue, setViewValue } from '../../store/viewStateSlice.js';

const has = (bag, key) => Boolean(bag) && Object.prototype.hasOwnProperty.call(bag, key);
const resolve = (initial) => (typeof initial === 'function' ? initial() : initial);
const initialValues = new Map();
const mounted = new Map();

function initialFor(key, initial) {
  if (!initialValues.has(key)) initialValues.set(key, resolve(initial));
  return initialValues.get(key);
}

export default function useViewState(initial) {
  const key = useId();
  const dispatch = useDispatch();
  const fallback = initialFor(key, initial);

  const stored = useSelector(
    (state) => (has(state.viewState, key) ? { value: state.viewState[key] } : null),
    (a, b) => (a && b ? a.value === b.value : a === b),
  );
  const value = stored ? stored.value : fallback;

  const setValue = useCallback(
    (next) =>
      dispatch((innerDispatch, getState) => {
        const bag = getState().viewState;
        const current = has(bag, key) ? bag[key] : initialValues.get(key);
        innerDispatch(setViewValue({ key, value: typeof next === 'function' ? next(current) : next }));
      }),
    [dispatch, key],
  );

  useEffect(() => {
    mounted.set(key, (mounted.get(key) || 0) + 1);
    return () => {
      mounted.set(key, mounted.get(key) - 1);
      queueMicrotask(() => {
        if (mounted.get(key) > 0) return;
        mounted.delete(key);
        initialValues.delete(key);
        dispatch(clearViewValue(key));
      });
    };
  }, [dispatch, key]);

  return [value, setValue];
}
