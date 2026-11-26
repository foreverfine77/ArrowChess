import { BAMBOO_THEME, type Theme } from './renderer';

const BAMBOO_BOARD: Theme = {
  ...BAMBOO_THEME,
  bg: '#e6ead5',
  paper: { light: '#f0f0dd', dark: '#dee6cc', border: '#9cab8547' },
  pointFill: '#f1f1df',
  text: '#344a36',
};

const INK_BOARD: Theme = {
  ...BAMBOO_THEME,
  bg: '#4d634d',
  paper: { light: '#617558', dark: '#4d634d', border: '#c3d7ac42' },
  edge: '#97aa8b',
  red: '#f0967f',
  black: '#182721',
  pointFill: '#4d634a',
  pointStroke: '#becbaf',
  legal: '#dceab8',
  selected: '#ecba75',
  lastMove: '#e6bc73',
  hint: '#b5e3e3',
  text: '#f6f4dc',
  arrowOnRed: '#fad0ba',
  arrowOnBlack: '#17231d',
  redClosed: '#788d6b',
  blackClosed: '#788d6b',
  arrowOnRedClosed: '#d4dfc5',
  arrowOnBlackClosed: '#d4dfc5',
};

export function boardTheme(ink: boolean): Theme {
  return ink ? INK_BOARD : BAMBOO_BOARD;
}
