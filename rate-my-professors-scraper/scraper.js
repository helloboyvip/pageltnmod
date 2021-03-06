/**
 * Loads a resource as plain text
 * @param {string} theUrl the URL to the resource to load
 * @returns {Promise<string>} Resolves with the text on success, rejects on failure
 */
function httpGetAsync(theUrl)
{
    return new Promise(function(resolve,reject){
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
                resolve(xmlHttp.responseText);
        }
        xmlHttp.open("GET", theUrl, true); // true for asynchronous
            xmlHttp.onerror = reject;
        //xmlHttp.setRequestHeader("origin", true);
        xmlHttp.send(null);
    });
}

/**
Get valid RateMyProfessor URLs from Google
@param {string[]} keywords array of keywords to google search
@returns {Promise<string[]>} array of valid rate my professors URLs
*/
async function loadURLs(keywords){
    return new Promise(async function (resolve,reject){
        //prepare keywords
        keywords = keywords.join('+').replace(/ /g,'+').toLowerCase();

        //load google results
        let str = cors+"https://www.google.com/search?q="+keywords+"&num=50";
        let res = await httpGetAsync(str).catch(()=>{alert("Could not load")});
        let dummy = document.createElement('html');
        dummy.innerHTML = res;

        let usable = [];
        {
                //get all the links on the page
                let links = dummy.getElementsByTagName('a');
                dummy.remove();
                for(let link of links){
                    if (!link.href.includes("webcache.google") && link.href.includes("ratemyprofessor")){
                        usable.push(link.href);
                    }
                }
        }
        resolve(usable);
    });
}

/**
Get statistics about a professor by scraping the RateMyProfessors page
@param {string} url the URL to the rate my professors page
@param {string} school the full name of the school for validation
@param {string} classname the name of the class for validation
@returns {} undefined if the page is bad, or a dictionary with stats
*/
async function processURL(url,school,classname){
    return new Promise(async function(resolve,reject){
        let res = await httpGetAsync(cors + url).catch(()=>{alert("Could not load")});
        let dummy = document.createElement('html');
        dummy.innerHTML = res;

        //sanity check: correct school?
        let pschool;
        try{
            pschool = dummy.getElementsByClassName("NameTitle__Title-dowf0z-1 wVnqu")[0].getElementsByTagName("a")[0].innerText;
            if (!pschool.includes(school)){
                resolve()
                return;
            }
        }
        catch(e){resolve();return;}

        //sanity check: correct classes listed?
        let classes = dummy.getElementsByClassName('RatingHeader__StyledClass-sc-1dlkqw1-2');
        let correct = 0;
        for (let cl of classes){
            if (cl.innerText.toLowerCase() == classname){
                correct++;
            }
        }
        if (correct == 0){
            resolve()
            return;
        }

        //get the name
        let summary = {};
        let name = dummy.getElementsByClassName('NameTitle__Name-dowf0z-0')[0];
        name = name.innerText.trim().split(' ');
        name = name[0] + " " + name[name.length-1];
        summary["Name"] = name;

        //get the rating info
        let scores = dummy.getElementsByClassName('RatingValue__Numerator-qw8sqy-2')[0];
        summary["Grade"] = parseFloat(scores.innerText);

        //calculate the average difficulty (Rate my professors removed this summary stat)
        let diffs = dummy.getElementsByClassName("RatingValues__RatingValue-sc-6dc747-3");
        let difficulty = 0;
        for (let diff of diffs){
            difficulty += parseFloat(diff.innerText);
        }
        summary["Difficulty"] = (difficulty/diffs.length).toFixed(2);

        //get the number of ratings
        let nratings = dummy.getElementsByClassName("TeacherRatingTabs__StyledTab-pnmswv-1")[0];
        summary["Ratings"] = parseInt(nratings.innerHTML);

        //get the review dates, find the most recent
        let dates = dummy.getElementsByClassName("TimeStamp__StyledTimeStamp-sc-9q2r30-0")
        let newest = new Date(0);
        let months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        for (let date of dates){
            //get the class the date is associated with
            let parent = date.parentElement.parentElement;
            let cl = date.parentElement.innerText;
            
            //if the class is correct
            if (cl.toLowerCase().includes(classname)){
               
                //format date
                let dateparts = [0,0,0];
                dateparts[0] = months.indexOf(date.innerText.substring(0,3))
                dateparts[1] = parseInt(parseInt(date.innerText.substring(4,6)));
                dateparts[2] = parseInt(date.innerText.substring(9,15));

                 //compare dates
                let d = new Date(dateparts.join('/'));

                if (d > newest){
                    newest = d;
                }
            }
        }
        summary["Most_Recent_Review"] = newest.toLocaleDateString()
        summary["School"] = pschool;

        //clean up
        dummy.remove()
        resolve(summary);
    });
}
