// Web build only: expo-router draws NativeTabs as a floating pill at the top of the page with
// 20px padding per tab and 15px labels, about 433px wide, so on a 375px phone browser it scrolls
// and the last tab and the selected pill go off-screen. This stylesheet lets the five tabs share
// the width on narrow screens. iOS and Android load web-tab-bar.ts instead and do not change.
import './web-tab-bar.css';
