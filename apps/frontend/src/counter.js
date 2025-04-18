export function setupCounter(element) {
  let counter = 0
  const setCounter = (count) => {
    counter = count
    element.innerHTML = `count is ${counter}`
  }
  element.addEventListener('click', () => {

      fetch("api/setCounter", {
          method:"POST",
          body: JSON.stringify({ counter })
      })
      .then(res=>{
          return res.json();
      })
      .then((data)=>{
          console.log(data);
      })
      .catch(err=>{
          console.error(err);
      });

      setCounter(counter + 1);

  })
  setCounter(0)
}
